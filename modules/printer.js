let Printer = syzoj.model('printer')
let User = syzoj.model('user');



app.get('/printer/:type?', async (req, res) => {
  try {
    let user = res.locals.user
    if (user && (user.is_admin || user.nickname === "watcher" || user.nickname === "printer")){
      if (!['checked', 'unchecked'].includes(req.params.type)) {
        res.redirect(syzoj.utils.makeUrl(['printer', 'unchecked']))
        return
      }
      const in_checked = req.params.type === 'checked'

      let where
      if(in_checked){
        where = {is_printed: true}
      }else{
        where = {is_printed: false}
      }
      let paginate = syzoj.utils.paginate(await Printer.countForPagination(where), req.query.page, syzoj.config.page.question)

      let printers = await Printer.queryPage(paginate, where, {
        id: in_checked ? "DESC" : 'ASC'
      })

      res.render("printer", {
        in_checked: in_checked,
        printers: printers,
        paginate: paginate
      })
    }else{
      if (req.params.type){
        res.redirect(syzoj.utils.makeUrl(['printer']))
        return
      }
      res.render('printer', {});
    }
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/printer/print/:id', async (req, res) => {
  try{
    let user = res.locals.user

    if(!(user && (user.is_admin || user.nickname === 'watcher' || user.nickname === 'printer'))){
      throw new ErrorMessage("你无权查看此界面")
    }

    let printer = await Printer.findById(req.params.id)
    if (!printer){
      throw new ErrorMessage("未找到此打印请求")
    }


    res.render('printer_show', {
      printer: printer,
      print_id: req.params.id
    })
  } catch (e) {
    syzoj.log(e)
    res.render('error', {
      err: e
    })
  }
})

app.get('/printer_success', async (req, res) => {
  try {
    res.render('printer_success', {

    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get("/printer/mark/:id", async (req, res) => {
  try {
    let user = res.locals.user

    if(!(user && (user.is_admin || user.nickname === 'watcher' || user.nickname === 'printer'))){
      throw new ErrorMessage("你无权查看此界面")
    }

    let printer = await Printer.findById(req.params.id)
    if (!printer){
      throw new ErrorMessage("未找到此打印请求")
    }

    printer.is_printed = true;

    await printer.save();
    res.redirect(syzoj.utils.makeUrl("printer", "unchecked"))

  } catch (e) {
    syzoj.log(e)
    res.render('error', {
      err: e
    })
  }
})

app.post('/printer', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let time = syzoj.utils.getCurrentDate();
    let printer = await Printer.create();
    printer.user_id = res.locals.user.id
    printer.submit_time = time;

    if (!req.body.print_content.trim()) throw new ErrorMessage('打印内容不能为空.');
    printer.print_content = req.body.print_content
    printer.user_name = res.locals.user.username
    printer.is_printed = false;

    await printer.save();

    res.redirect("/printer_success")

  } catch (e) {
    syzoj.log(e);
    res.render ('error', {
      err: e
    });
  }
})
