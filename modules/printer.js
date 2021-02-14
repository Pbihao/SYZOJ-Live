let Printer = syzoj.model('printer')
let User = syzoj.model('user');

app.get('/printer', async (req, res) => {
  try {


    res.render('printer', {

    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
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

app.post('/printer', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let time = syzoj.utils.getCurrentDate();
    let printer = await Printer.create();
    printer.user_id = res.locals.user.id
    printer.submit_time = time;

    if (!req.body.print_content.trim()) throw new ErrorMessage('打印内容不能为空.');
    printer.print_content = req.body.print_content
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
