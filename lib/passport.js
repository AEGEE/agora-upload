const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy

const config = require('../config.json');

passport.use('local', new CustomStrategy((req, callback) => {
    if (!req.body.username || !req.body.password) return callback(null, false);
    if (req.body.username !== config.admin.login) return callback(null, false);
    if (req.body.password !== config.admin.password) return callback(null, false);

    return callback(null, { username: req.body.username });
}));

passport.serializeUser((user, done) => done(null, user.username));
passport.deserializeUser((username, done) => done(null, { username }));

module.exports = passport;
