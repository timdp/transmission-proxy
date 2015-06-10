# Transmission Proxy

[![npm](https://img.shields.io/npm/v/transmission-proxy.svg)](https://www.npmjs.com/package/transmission-proxy) [![JavaScript Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

A simple proxy server for the Transmission RPC API.

The proxy only allows the `torrent-add` method. This makes it ideal for use with
external services that are only allowed to push new torrents to your daemon.
One example is [showRSS](http://showrss.info/).

The app comes ready for deployment on [Heroku](https://www.heroku.com/) as well
as [OpenShift](https://www.openshift.com/). However, being a standard
[node.js](http://nodejs.org/) app, it can be run pretty much anywhere.

## Configuration

In `config.json.example`, you will find a sample configuration to get you on
your way. Just copy it to `config.json` and paste in your configuration.

By default, the app's queue gets stored in memory. However, for improved
robustness and scalability, it can also store it in a relational database.
To enable this feature:

1. Create a [PostgreSQL](http://www.postgresql.org/) database with the
following schema:

    ```sql
    CREATE TABLE "queue" (
      "id" SERIAL PRIMARY KEY,
      "filename" TEXT NOT NULL,
      "time" TIMESTAMP WITH TIME ZONE NOT NULL
    );
    ```

2. Adapt `config.json` to connect to the database:

    ```json
    {
      "storage": {
        "type": "postgresql",
        "postgresql": {
          "database_url": "postgresql://USERNAME:PASSWORD@HOST:PORT"
        }
      }
    }
    ```

    If you use Heroku or OpenShift's native PostgreSQL support, the database
    URL will be automatically detected from the environment.

## API

API documentation is in the works. See `src/server.js` for example usage of the
`transmission-proxy` module.

## Author

[Tim De Pauw](https://tmdpw.eu/)

## License

Copyright &copy; 2015 Tim De Pauw

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
