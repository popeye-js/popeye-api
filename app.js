const PirateBay = require('thepiratebay');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const imdb = require('imdb-api');
const reqPromise = require('request-promise-native');
const request = require('request');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

if (IS_PROD) {
  process.env.SERVER_USE_HTTPS = process.env.SERVER_USE_HTTPS || 'true';
  process.env.CLIENT_USE_HTTPS = process.env.CLIENT_USE_HTTPS || 'true';
  process.env.CLIENT_HOST = process.env.CLIENT_HOST || 'popeye-api.herokuapp.com';
  process.env.CLIENT_PORT = process.env.CLIENT_PORT || '';
}

const SERVER_USE_HTTPS = (process.env.SERVER_USE_HTTPS || '').toString === 'true';
const SERVER_PROTOCOL = SERVER_USE_HTTPS ? 'https:' : 'http:';
const SERVER_HOST = process.env.SERVER_HOST || process.env.HOST || '0.0.0.0';
const SERVER_PORT = process.env.SERVER_PORT || process.env.PORT || 7001;

const CLIENT_USE_HTTPS = (process.env.CLIENT_USE_HTTPS || '').toString === 'true';
const CLIENT_PROTOCOL = CLIENT_USE_HTTPS ? 'https:' : 'http:';
const CLIENT_HOST = process.env.CLIENT_HOST || process.env.HOST || '0.0.0.0';
const CLIENT_PORT = process.env.CLIENT_PORT || process.env.PORT || 7000;

let URLS = {
  client: {
  },
  server: {
  },
  putio: {
    base: 'https://api.put.io/v2'
  }
};

URLS.client.base = IS_PROD ? `${CLIENT_PROTOCOL}//${CLIENT_HOST}` : `${CLIENT_PROTOCOL}//${CLIENT_HOST}`;
// NOTE: We set `CLIENT_PORT` so it will the client base URL will be `http://0.0.0.0:7000`, for example.
if (CLIENT_PORT) {
  URLS.client.base += `:${CLIENT_PORT}`;
}

URLS.server.base = IS_PROD ? `${SERVER_PROTOCOL}//${SERVER_HOST}` : `${SERVER_PROTOCOL}//${SERVER_HOST}`;
// NOTE: We don't need to set `SERVER_PORT` for production, since the URL will be `https://`.

URLS.putio.redirect = `${URLS.server.base}/putio/authenticate/redirect`;
URLS.putio.oauthBase = `${URLS.putio.base}/oauth2`;
URLS.putio.accessToken = `${URLS.putio.oauthBase}/access_token`;
URLS.putio.authenticate = `${URLS.putio.oauthBase}/authenticate?client_id=2801&response_type=code&redirect_uri=${URLS.putio.redirect}`;
// popcorn time api 
URLS.fetchMovie = imdbid => `https://tv-v2.api-fetch.website/movie/${imdbid}`;
URLS.fetchTVEpisode = imdbid => `https://tv-v2.api-fetch.website/show/${imdbid}`;

var app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(cors());  // Enable CORS headers on responses for all routes.

app.get('*', (req, res, next) => {
  console.log('[GET]', req.url, req.body, req.query);
  next();
});

app.post('*', (req, res, next) => {
  console.log('[POST]', req.url, req.body, req.query);
  next();
});

var cache = {
  pb: {}
};

var db = {
  requests: []
};

app.get('/', (req, res) => {
  res.send({
    status: 'ok'
  });
});

app.get('/requests', (req, res) => {
  res.send(db.requests);
});

app.post('/requests', (req, res) => {
  if (req.body) {
    db.requests.push(req.body);
    res.send({
      success: true
    });
    return;
  }
  res.send({
    success: false
  });
});

app.delete('/requests', (req, res) => {
  db.requests = [];
  res.send({
    success: true
  });
});

app.get('/torrents', (req, res, next) => {
  // Get the `q` query-string parameter from the URL (e.g., `/torrents?q=big+buck+bunny`).
  var q = req.query.q;

  if (q in cache.pb) {
    // If we found a cached JSON blob for the search term, then
    // immediately send the response, but still run the search query
    // asynchronously in the background to update the cache for
    // subsequent requests.
    res.send(cache.pb[q]);
  }

  PirateBay.search(q, {}).then(results => {
    cache.pb[q] = results; // Update the cached entry.
    res.send(results); // Send the JSON blob.
  }).catch(err => {
    if (!err || !err.message) {
      err = new Error('Unknown error occurred fetching torrents');
    }

    console.error(err);

    res.status(400).send({
      error: err.message
    });
  });
});

app.get('/movie', (req, res, next) => {
  var name = req.query.name;

  var key = '/movie/' + name;
  if (key in cache.pb) {
    res.send(cache.pb[key]);
  }

  let torrentData = {};
  var getMovieData = name => {
    return imdb.get(name).then(data => {
      if (data.type != 'movie') {
        return new Error('Result is not a movie')
      }
      torrentData.title = data.title;
      torrentData.plot = data.plot;
      torrentData.year = data.year;
      torrentData.runtime = data.runtime;
      torrentData.poster = data.poster;
      return data.imdbid;
    })
  }

  var loadMovie = imbdId => {
    const url = URLS.fetchMovie(imbdId);
    return reqPromise(url).then(body => {
      body = JSON.parse(body);
      torrentData.magnetLink = body.torrents.en['720p'].url;

      cache.pb[key] = torrentData;  // Update the cached entry.
      res.send(torrentData);  // Send the JSON blob.
    });
  };

  var handleErrors = err => {
    if (!err || !err.message) {
      err = new Error('Unknown error occurred while fetching movie');
    }
    console.error(err);
    res.status(400).json({
      error: err.message
    });
  };

  getMovieData(name).then(loadMovie).catch(handleErrors);

});

// Get the latest episode
app.get('/latestEpisode', (req, res, next) => {
  var show = req.query.show;

  var key = '/latestEpisode/' + show;
  var isCached = false;
  if (key in cache.pb) {
    isCached = true;
    res.json(cache.pb[key]);
  }

  let torrentData = {};

  var loadShow = show => {
    return imdb.get(show).then(data => {
      torrentData.title = data.title;
      torrentData.runtime = data.runtime;
      torrentData.poster = data.poster;
      return data.imdbid;
    });
  };

  const loadEpisode = imbdid => {
    const url = URLS.fetchTVEpisode(imbdid);

    return reqPromise(url).then(body => {
      body = JSON.parse(body);

      // get episodes of the current or latest season.
      var num_seasons = body.num_seasons;
      var currSeason = [];
      body.episodes.forEach(function (episode) {
        if (episode.season == num_seasons) {
          currSeason.push(episode);
        }
      });

      // find the latest episode
      var highestEp = 0;
      var index = 0;
      for (var i = 0; i < currSeason.length; i++) {
        if (currSeason[i].episode > highestEp) {
          highestEp = currSeason[i].episode;
          index = i;
        }
      }

      var latestEp = currSeason[index];
      torrentData.magnetLink = latestEp.torrents['0'].url;
      var airedDate = new Date();
      airedDate.setTime(latestEp.first_aired * 1000);
      torrentData.first_aired = airedDate.toDateString();
      torrentData.overview = latestEp.overview;
      torrentData.ep_title = latestEp.title;
      torrentData.episode = latestEp.episode;
      torrentData.season = latestEp.season;

      return body;
    });
  };

  var handleErrors = err => {
    if (!err || !err.message) {
      err = new Error('Unknown error occurred while fetching TV episode');
    }

    console.error(err);

    res.status(400).json({
      error: err.message
    });
  };

  loadShow(show).then(loadEpisode).then(body => {
    cache.pb[key] = torrentData;  // Update the cached entry.
    // Can't send the data twice.
    if (!isCached) {
      res.json(torrentData);  // Send the JSON blob.
    }
  }).catch(handleErrors);
});

app.get('/putio/authenticate', (req, res) => {
  res.redirect(URLS.putio.authenticate);
});

app.get('/putio/authenticate/redirect', (req, res, next) => {

  var options = {
    uri: URLS.putio.access_token,
    qs: {
      client_id: '2801',
      client_secret: 'RNBYMVGCQE357PWIHN33',
      grant_type: 'authorization_code',
      // The URI must match the registered URI in Put.io's API Developer settings.
      redirect_uri: URLS.putio.redirect,
      code: req.query.code
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true  // Automatically parse the JSON string in the response.
  };

  reqPromise(options)
    .then(result => {
      // TODO: Use CSRF middleware for express.
      // res.cookie('access_token', result.access_token);
      res.redirect(URLS.client.base);
    })
    .catch(err => {
      // API call failed.
      console.error(err);
    });
});

app.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log('Listening on port %s//%s:%s',
    SERVER_PROTOCOL, SERVER_HOST, SERVER_PORT);
});
