var passport = require('passport')
    , index = require('./routes/index')
    , Account = require('./models/account')
    , Datum = require('./models/datum')
    , Category = require('./models/category')
    , Mailgun = require('mailgun').Mailgun;

var mg = new Mailgun('key-5n1bqp873lh8yritf-uiogsvgn120fa4');
// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

module.exports = function (app) {

    app.get('/register', function(req, res) {
        res.render('register', { title: 'Register', user: req.user, message: req.flash('info'), error: req.flash('error') });
    });

    app.post('/register', function(req, res) {
      if (req.body.password != req.body.password_conf) {
        req.flash('error', 'Password and password confirmation must match.')
        res.redirect('/register');
      }
      Account.register(new Account({ email : req.body.email }), req.body.password, function(err, account) {
          if (err) {
              req.flash('error', 'That email is already in use.')
              return res.redirect('/register');
          }
          // Welcome email
          mg.sendText('info@track.me', [req.body.email],
            'Welcome to tracking!',
            'Welcome to tracking! You can always track yourself, every day, on the home page: http://track.me',
            'trackme.mailgun.org', {},
            function(err) {
              if (err) console.log('Oh noes: ' + err);
              else     console.log('Successful Welcome email');
          });
          // Then redirect
          req.flash('info', 'Now log in using the account you just created.')
          res.redirect('/account');
      });
    });

    app.get('/account', ensureAuthenticated, function(req, res){
      Datum.find({account: req.user._id}).sort('-date').exec(function(err,data) { // Find account data
        Category.populate(data, {path: 'category', model: 'Category'}, function(err, data) {
          res.render('account', { user: req.user, title : "Your account", data: data, message: req.flash('info') });
        })
      })
    });

    app.post('/account', ensureAuthenticated, function(req, res){
      var conditions = { _id: req.user._id }, month, day, year;
      if (req.body.birthdate) {
        month = req.body.birthdate[0]+req.body.birthdate[1];
        day = req.body.birthdate[3]+req.body.birthdate[4];
        year = req.body.birthdate[6]+req.body.birthdate[7]+req.body.birthdate[8]+req.body.birthdate[9];
      }
      var updates = { username : req.body.username, 
                      email : req.body.email, 
                      gender : req.body.gender, 
                      birthdate : new Date(year, month-1, day),
                      occupation : req.body.occupation,
                      location : req.body.location}
      Account.update(conditions, updates, function updatedAccount(err) {
        if(err) {
          req.flash('error', 'There was a problem in saving that information')
          res.redirect('/account');
          throw err;
        }
      });
      req.flash('info', 'Updated!')
      res.redirect('/');
    });

    app.get('/login', function(req, res) {
      res.render('login', { title: 'Log In', user: req.user, message: req.flash('info'), error: req.flash('error') });
    });

    app.post('/login', passport.authenticate('local', { failureRedirect: '/login', failureFlash: 'Invalid email or password.' }), function(req, res) {
        req.flash('info', 'Hi there!')
        res.redirect('/');
    });

    app.get('/reset-password', ensureAuthenticated, function(req, res) {
      res.render('reset-password', { title: 'Reset Password', user: req.user, message: req.flash('info'), error: req.flash('error') });
    });

    app.post('/reset-password', ensureAuthenticated, function(req, res) {
      if (req.body.password != req.body.password_conf) {
        req.flash('error', 'New password and password confirmation must match.')
        res.redirect('/reset-password');
      }
      Account.findById(req.user._id, function foundAccount(err, account){
        account.setPassword(req.body.password, function setPassword(err, resetAccount){
          if(err) {
            req.flash('error', 'There was a problem in saving that information')
            res.redirect('/account');
            throw err;
          }
          resetAccount.save(function(err, saved){
            if(err) {
              req.flash('error', 'There was a problem in saving that information')
              res.redirect('/account');
              throw err;
            }
            req.flash('info', 'New password saved!')
            res.redirect('/account');
          })
        })
      })
    });

    app.get('/logout', function(req, res) {
        req.logout();
        req.flash('info', 'You have been logged out. Thanks for staying on track!')
        res.redirect('/');
    });
};