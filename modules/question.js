let Problem = syzoj.model('problem');
let Article = syzoj.model('article');
let ArticleComment = syzoj.model('article-comment');
let User = syzoj.model('user');

app.get('/question/:type?', async (req, res) => {
  try {
    if (!['global', 'read'].includes(req.params.type)) {
      res.redirect(syzoj.utils.makeUrl(['question', 'global']));
      return
    }
    const in_read = req.params.type === 'read';
    let user = res.locals.user;

    if(!user){
      res.render("question", {
        articles: null,
        paginate: null,
        problem: null,
        in_read: in_read
      })
      return
    }

    let articles = null;
    let paginate = null;
    let where;
    //如果是观察员（包括管理员和观察员）则返回的未读的信息或者已读的信息
    if(syzoj.utils.canWatch(res.locals.user)){
      if(in_read){
        where = {
          competitor_edited: false
        }
        paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.question);
        articles = await Article.queryPage(paginate, where, {
          sort_time: 'DESC'
        });
      }else {
        where = {
          competitor_edited: true
        }
        paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.question);
        articles = await Article.queryPage(paginate, where, {
          sort_time: 'ASC'
        });
      }

      for (let article of articles) {
        await article.loadRelationships();
        if (article.competitor_edited)article.new_reply = true;
        else article.new_reply = false
      }
    }
    //如果不是观察者
    else{
      if (in_read){
        throw new ErrorMessage("You are not allowed to watch this page.")
      }else{
        where = {
          problem_id: null,
          user_id: user.id
        }
        paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.question);
        articles = await Article.queryPage(paginate, where, {
          sort_time: 'DESC'
        });

        for (let article of articles) {
          await article.loadRelationships();
          if (article.watcher_edited)article.new_reply = true;
          else article.new_reply = false
        }
      }
    }




    res.render('question', {
      articles: articles,
      paginate: paginate,
      problem: null,
      in_read: in_read
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/question/problem/:pid', async (req, res) => {
  try {
    let pid = parseInt(req.params.pid);
    let problem = await Problem.findById(pid);
    if (!problem) throw new ErrorMessage('无此题目。');
    if (!await problem.isAllowedUseBy(res.locals.user)) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    let where = { problem_id: pid };
    let paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.question);
    let articles = await Article.queryPage(paginate, where, {
      sort_time: 'DESC'
    });

    for (let article of articles) await article.loadRelationships();

    res.render('question', {
      articles: articles,
      paginate: paginate,
      problem: problem,
      in_read: false
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');

    //清除未读标记
    if (res.locals.user && syzoj.utils.canWatch(res.locals.user) && article.competitor_edited === true){
      article.competitor_edited = false;
      await article.save()
    }else if(res.locals.user && article.watcher_edited === true && res.locals.user.id === article.user_id){
      article.watcher_edited = false;
      await  article.save()
    }


    await article.loadRelationships();
    article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
    article.allowedComment = await article.isAllowedCommentBy(res.locals.user);
    article.content = await syzoj.utils.markdown(article.content);

    let where = { article_id: id };
    let commentsCount = await ArticleComment.countForPagination(where);
    let paginate = syzoj.utils.paginate(commentsCount, req.query.page, syzoj.config.page.article_comment);

    let comments = await ArticleComment.queryPage(paginate, where, {
      public_time: 'DESC'
    });

    for (let comment of comments) {
      comment.content = await syzoj.utils.markdown(comment.content);
      comment.allowedEdit = await comment.isAllowedEditBy(res.locals.user);
      await comment.loadRelationships();
    }

    let problem = null;
    if (article.problem_id) {
      problem = await Problem.findById(article.problem_id);
      if (!await problem.isAllowedUseBy(res.locals.user)) {
        throw new ErrorMessage('您没有权限进行此操作。');
      }
    }



    res.render('article', {
      article: article,
      comments: comments,
      paginate: paginate,
      problem: problem,
      commentsCount: commentsCount
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      article = await Article.create();
      article.id = 0;
      article.allowedEdit = true;
    } else {
      article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
    }

    res.render('article_edit', {
      article: article
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    let time = syzoj.utils.getCurrentDate();
    if (!article) {
      article = await Article.create();
      article.user_id = res.locals.user.id;
      article.public_time = article.sort_time = time;

      if (req.query.problem_id) {
        let problem = await Problem.findById(req.query.problem_id);
        if (!problem) throw new ErrorMessage('无此题目。');
        article.problem_id = problem.id;
      } else {
        article.problem_id = null;
      }
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    if (!req.body.title.trim()) throw new ErrorMessage('标题不能为空。');
    article.title = req.body.title;
    article.content = req.body.content;
    article.update_time = time;
    article.is_notice = (res.locals.user && res.locals.user.is_admin ? req.body.is_notice === 'on' : article.is_notice);

    if(!syzoj.utils.canWatch(res.locals.user)){
      article.competitor_edited = true
    }else{
      article.watcher_edited = true
    }

    await article.save();

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    await Promise.all((await ArticleComment.find({
      article_id: article.id
    })).map(comment => comment.destroy()))

    await article.destroy();

    res.redirect(syzoj.utils.makeUrl(['question', 'global']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/comment', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedCommentBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    let comment = await ArticleComment.create({
      content: req.body.comment,
      article_id: id,
      user_id: res.locals.user.id,
      public_time: syzoj.utils.getCurrentDate()
    });

    await comment.save();

    await article.resetReplyCountAndTime();

    //确定是否修改
    if(syzoj.utils.canWatch(res.locals.user)){
      article.watcher_edited = true;
      await article.save()
    }else{
      article.competitor_edited = true;
      await article.save()
    }

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:article_id/comment/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let comment = await ArticleComment.findById(id);

    if (!comment) {
      throw new ErrorMessage('无此评论。');
    } else {
      if (!await comment.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    const article = await Article.findById(comment.article_id);

    await comment.destroy();

    await article.resetReplyCountAndTime();

    res.redirect(syzoj.utils.makeUrl(['article', comment.article_id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
