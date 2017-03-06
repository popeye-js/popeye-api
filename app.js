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
  // Get the `q` query-string parameter from the URL (e.g., `/torrents?q=big+buck+bunny`).
  var q = req.params.q;

  if (q in cache.pb) {
    // If we found a cached JSON blob for the search term, then
    // immediately send the response, but still run the search query
    // asynchronously in the background to update the cache for
    // subsequent requests.
    res.send(cache.pb[q]);
  }

  PirateBay.search(q, {}).then(results => {
    cache.pb[q] = results;  // Update the cached entry.
    res.send(results);  // Send the JSON blob.
  }).catch(err => {
    if (!err || !err.message) {
      error = new Error('Unknown error occurred');
    }
    console.error(err);
    res.send({
      error: err.message
    })
  });
});

app.listen(PORT, () => {
  console.log('Listening on port %s', PORT);
});
