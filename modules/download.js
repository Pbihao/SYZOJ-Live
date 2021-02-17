const download_station_path = syzoj.utils.resolvePath(syzoj.config.upload_dir, 'downloadStation')
const fs = require('fs-extra')
const path = require('path')


app.get("/download", async (req, res) => {
  try {
    let filenameList = await fs.readdir(download_station_path)
    let list = await Promise.all(filenameList.map(async x => {
      let stat = await fs.stat(path.join(download_station_path, x))
      if (!stat.isFile()) return undefined
      return {
        filename: x,
        size: stat.size
      }
    }))

    list = list.filter(x => x)


    res.render("download", {
      filedata: list
    })
  } catch (e) {
    syzoj.log(e);
    res.status(404);
    res.render('error', {
      err: e
    });
  }
})

app.get('/download/download/:filename', async (req, res) => {
  try {
    if (typeof req.params.filename === 'string' && (req.params.filename.includes('../'))) throw new ErrorMessage('您没有权限进行此操作。)');

    let file_path = path.join(download_station_path, req.params.filename)
    if (! await syzoj.utils.isFile(file_path))throw new ErrorMessage('文件不存在...')
    let sendName = path.basename(file_path)

    if (syzoj.config.site_for_download) {
      res.redirect(syzoj.config.site_for_download + syzoj.utils.makeUrl(['api', 'v2', 'download', jwt.sign({
        filename: file_path,
        sendName: sendName,
        originUrl: syzoj.utils.getCurrentLocation(req)
      }, syzoj.config.session_secret, {
        expiresIn: '2m'
      })]));
    } else {
      res.download(file_path, sendName);
    }

  } catch (e) {
    syzoj.log(e);
    res.status(404);
    res.render('error', {
      err: e
    });
  }
})

app.post('/download/upload', app.multer.array('file'), async (req, res) => {
  try {
    if (! syzoj.utils.canWatch(res.locals.user))throw new ErrorMessage('您没有权限此操作.')

    await fs.ensureDir(download_station_path)

    if (req.files) {
      for (let file of req.files) {
        let new_path = path.join(download_station_path, file.originalname)
        await fs.move(file.path, new_path, {
          overwrite: true
        })
      }
    }

    res.redirect(syzoj.utils.makeUrl(['download']))
  } catch (e) {
    syzoj.log(e)
    res.render('error', {
      err: e
    })
  }
})

app.post('/download/delete/:filename', async (req, res) => {
  try {
    if(!syzoj.utils.canWatch(res.locals.user))throw new ErrorMessage('您没有权限进行此操作。)');
    if (typeof req.params.filename === 'string' && (req.params.filename.includes('../'))) throw new ErrorMessage('您没有权限进行此操作。)');
      let file_path = path.join(download_station_path, req.params.filename)
      await fs.remove(file_path)
      res.redirect(syzoj.utils.makeUrl("download"))
  } catch (e) {
    syzoj.log(e)
    res.render('error', {
      err: e
    })
  }
})
