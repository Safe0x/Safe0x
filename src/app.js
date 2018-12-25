const Koa = require('koa')
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')
const Boom = require('boom')
const render = require('koa-ejs')
const serve = require('koa-static')
const path = require('path')
const session = require('koa-session')
const validator = require('validator')
const user = require('./module/user')

const app = module.exports = new Koa()
const router = new Router()

// TODO: Replace hardcoded key with dynamically generated one.
app.keys = ['']
app.proxy = true

const sessionConfig = {
  key: 'safe0x:sess',
  maxAge: 86400000,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: false
}

// TODO: Check storj.destroy and session conflict issue.
app.use(session(sessionConfig, app))
app.use(serve(__dirname + '/assets'))

render(app, {
  root: path.join(__dirname, 'view'),
  layout: 'template',
  viewExt: 'html',
  cache: true,
  debug: false
})

router
  .get('/', async function (ctx, next) {
    this.session = null
    await ctx.render('index', { error: ''})
  })

  .get('/build-text', async function (ctx, next) {
    var data = { error: '' }

    if (ctx.session.safe0x_error) {
      data.error = ctx.session.safe0x_error
      ctx.session.safe0x_error = undefined
    }

    await ctx.render('text_form', data)
  })

  .post('/build-text', bodyParser(), async function (ctx, next) {
    try {
        if (!ctx.request.body.text[0]
          && !ctx.request.body.text[1]
          && !ctx.request.body.text[2]
        ) {
          throw new Error('Please enter your assets.')
        }

      ctx.session.safe0x_mnemonic = user.generateMnemonic()
      ctx.session.safe0x_text = ctx.request.body.text

      ctx.redirect('/build-mnemonic')
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect('/build-text')
    }
  })

  .get('/build-mnemonic', async function (ctx, next) {
    try {
      if (!ctx.session.safe0x_text) {
        throw new Error('Please enter your assets.')
      }

      var data = {
        mnemonic: ctx.session.safe0x_mnemonic,
        error: ''
      }

      if (ctx.session.safe0x_error) {
        data.error = ctx.session.safe0x_error
        ctx.session.safe0x_error = undefined
      }

      await ctx.render('mnemonic_build', data)
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect('/build-text')
    }
  })

  .post('/build-mnemonic', bodyParser(), async function (ctx, next) {
    var errorRedirect = '/build-mnemonic'

    try {
      if (!ctx.session.safe0x_text) {
        errorRedirect = '/build-text'
        throw new Error('Please enter your assets.')
      }

      const email = ctx.request.body.email

      // Validation is currently disabled.
      //if (!validator.isEmail(email)) {
        //throw new Error('Invalid email.')
      //}

      const isCaptchaValid = await user.isCaptchaValid(
        ctx.request.body['g-recaptcha-response'],
        ctx.ip
      )

      if (!isCaptchaValid) {
        throw new Error('Invalid captcha.')
      }

      var _user = await user.getUser(email)
      if (!_user) {
        _user = await user.addUser(email)
      }

      const fileCid = await user.storeText(
        ctx.session.safe0x_text,
        ctx.session.safe0x_mnemonic
      )

      ctx.session.safe0x_text = undefined
      ctx.session.safe0x_mnemonic = undefined
      ctx.session.safe0x_user = _user
      ctx.session.safe0x_file_cid = fileCid

      ctx.redirect('/build-success')
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect(errorRedirect)
    }
  })

  .get('/build-success', async function (ctx, next) {
    if (!ctx.session.safe0x_user
      || !ctx.session.safe0x_file_cid) {
      ctx.redirect('/')
    }

    const fileCid = ctx.session.safe0x_file_cid
    ctx.session.safe0x_user = undefined
    ctx.session.safe0x_file_cid = undefined

    await ctx.render('build_success', { error: '', file_cid: fileCid })
  })

  .get('/retrieve-login', async function (ctx, next) {
    var data = { error: '' }

    if (ctx.session.safe0x_error) {
      data.error = ctx.session.safe0x_error
      ctx.session.safe0x_error = undefined
    }

    await ctx.render('login', data)
  })

  .post('/retrieve-login', bodyParser(), async function (ctx, next) {
    try {
      const email = ctx.request.body.email

      // Validation is currently disabled.
      //if (!validator.isEmail(email)) {
        //throw new Error('Invalid email.')
      //}

      const isCaptchaValid = await user.isCaptchaValid(
        ctx.request.body['g-recaptcha-response'],
        ctx.ip
      )

      if (!isCaptchaValid) {
        throw new Error('Invalid captcha.')
      }

      const _user = await user.getUser(email)
      if (!_user) {
        throw new Error('Invalid email.')
      }

      ctx.session.safe0x_user = _user
      ctx.redirect('/retrieve-mnemonic')
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect('/retrieve-login')
    }
  })

  .get('/retrieve-mnemonic', async function (ctx, next) {
    var data = { error: '' }

    if (ctx.session.safe0x_error) {
      data.error = ctx.session.safe0x_error
      ctx.session.safe0x_error = undefined
    }

    await ctx.render('mnemonic_form', data)
  })

  .post('/retrieve-mnemonic', bodyParser(), async function (ctx, next) {
    var errorRedirect = '/retrieve-mnemonic'

    try {
      if (!ctx.session.safe0x_user) {
        errorRedirect = '/retrieve-login'
        throw new Error('Please enter your email.')
      }

      const text = await user.getText(
        ctx.request.body.mnemonic,
        ctx.request.body.safe_code
      )

      ctx.session.safe0x_text = text

      ctx.redirect('/retrieve-text')
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect(errorRedirect)
    }
  })

  .get('/retrieve-text', async function (ctx, next) {
    try {
      if (!ctx.session.safe0x_user) {
        throw new Error('Please enter your email.')
      }

      var data = {
        asset: ctx.session.safe0x_text,
        error: ''
      }

      ctx.session.safe0x_user = undefined
      ctx.session.safe0x_text = undefined

      await ctx.render('text', data)
    } catch (e) {
      ctx.session.safe0x_error = e.message
      ctx.redirect('/retrieve-login')
    }
  })

app
  .use(router.routes())
  .use(router.allowedMethods({
    throw: true,
    notImplemented: () => new Boom.notImplemented(),
    methodNotAllowed: () => new Boom.methodNotAllowed()
  }))

if (!module.parent) {
  app.listen(3000)
}
