const path = require('path');
const functions = require('firebase-functions');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app } = require('../server');

exports.api = functions.https.onRequest(app);
