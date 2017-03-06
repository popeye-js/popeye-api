var bodyParser = require('body-parser');
var express = require('express');
var PirateBay = require('thepiratebay');

var PORT = process.env.PORT || 7001;

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.get('*', (req, res, next) => {
  console.log('[GET]', req.url, req.body, req.params);
  next();
});

app.post('*', (req, res, next) => {
  console.log('[POST]', req.url, req.body, req.params);
  next();
});

var cache = {
  pb: {}
};

app.get('/torrents', (req, res, next) => {
  var q = req.params.q;
  if (q in cache.pb) {
    res.send(cache.pb[q]);
  }

  PirateBay.search(q, {
    category: 205
  }).then(results => {
    cache.pb[q] = results;
    res.send(results);
  }).catch(err => {
    console.error(err);
  });
});

app.listen(PORT, () => {
  console.log('Listening on port %s', PORT);
});
