# popeye.js

REST API for [Popeye voice controls](https://popeye-js.github.io/).


## Installation

First, clone this git repository:

```sh
git clone git@github.com:popeye-js/popeye-api.git
```

Ensure you have the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed. (For macOS using [Homebrew](https://brew.sh/), run `brew install heroku`.) Then, to set up the Heroku integration, run these commands using the `heroku` CLI:

```sh
heroku login
heroku git:remote -a popeye-api
```

Then, install the [Node](https://nodejs.org/) dependencies:

```sh
npm install
```


## Local development

To start the local development server:

```sh
npm start
```


## Deployment

To deploy the app to [production](https://popeye-api.herokuapp.com/):

```sh
npm run deploy
```


## License

[MIT](LICENSE.md)
