const express = require('express');
const path = require('path');
const sqlite = require('sqlite');
const uuid = require('uuid/v4');
const Sequelize = require('sequelize');
const util = require('util');
const multiparty = require('multiparty');
const fs = require('fs-extra');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const logger = require('./logger');
const passport = require('./passport')
const config = require('../config.json');

const uploadFolder = path.resolve(__dirname, '../uploads')

const promisifyUpload = (req) => new Promise((resolve, reject) => {
    const form = new multiparty.Form()
    form.parse(req, function(err, fields, files) {
        if (err) return reject(err);

        // Multiparty returns the object of such format:
        // { field: [ 'test' ], field2: [ 'test2' ] }
        // We are transferring it to this format:
        // { field: 'test', field2: 'test2' }
        // so it would take the 1st array element.
        // This was done to be able to pass this object directly to Sequelize.
        const filesFields = {}
        for (const key of Object.keys(fields)) {
            filesFields[key] = fields[key][0]
        }

        return resolve([filesFields, files]);
    });
});

const errorHandler = (error, res) => {
    if (error.name === 'SequelizeValidationError') {
        const object = error.errors.reduce((acc, val) => {
            if (acc[val.path]) {
                acc[val.path].push(val.message);
            } else {
                acc[val.path] = [val.message];
            }

            return acc;
        }, {});
        return res.status(422).json({ success: false, errors: object });
    }

    logger.error('ERROR', error)
    return res.status(400).json({ success: false, message: 'Error: ' + error.message });
}

const copyAsync = util.promisify(fs.copy);

const sequelize = new Sequelize('mainDB', null, null, {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '../database.sqlite'),
    operatorsAliases: false,
    logging: (sql, sequelizeObject) => logger.debug(sql),
});

const Submission = sequelize.define('Submission', {
    id: { type: String, allowNull: false, primaryKey: true },
    filepath: { type: String, allowNull: false },
    type: { type: String, validate: { isIn: ['candidature', 'opencall', 'plenarytime'] } },
    body: { type: String, allowNull: false },
    timeslot: { type: String, allowNull: false },
    person: { type: String, allowNull: false },
    email: { type: String, allowNull: false, validate: { isEmail: true } },
    created_at: { type: Sequelize.DATE, allowNull: false },
    updated_at: { type: Sequelize.DATE, allowNull: false },
}, { timestamps: true, underscored: true });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSession({ saveUninitialized: true, resave: true, secret: config.secret || 'test' }));
app.use(passport.initialize());
app.use(passport.session());

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (authErr, user, info) => {
        if (!user) {
            return res.status(200).json({ success: false, message: 'Error authorizing 2.'});
        }

        req.logIn(user, (err) => {
            if (err) {
                return res.status(200).json({ success: false, message: 'Error authorizing 3.' });
            }
            return res.status(200).json({ success: true });
        });
    })(req, res, next);
});

app.get('/api', async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized'})
    }
    const submissions = await Submission.all();
    res.json({ success: true, data: submissions });
    return next();
});

app.post('/api', async (req, res, next) => {
    try {
        const [fields, files] = await promisifyUpload(req)

        if (!files.file || !files.file[0]) {
            throw new Error('File is not provided.')
        }

        const fileName = Date.now() + '_' + files.file[0].originalFilename.toLowerCase().replace(/ /g, '_')
        await copyAsync(files.file[0].path, path.resolve(uploadFolder, fileName))

        fields.filepath = fileName
        fields.id = uuid()

        const newSubmission = await Submission.create(fields)
        return res.status(200).json({ success: true, data: newSubmission })
    } catch (err) {
        errorHandler(err, res)
    }
})

app.listen(config.port, async (err) => {
    logger.info(`App is listening on http://localhost:${config.port}/`);
    await sequelize.sync();
    logger.info('Schema is created.');
})