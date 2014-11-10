transmission-proxy
==================

A simple proxy server for the Transmission RPC API.

The proxy only allows the `torrent-add` method. This makes it ideal for use with
external services that are only allowed to push new torrents to your daemon.
One example is [showRSS](http://showrss.info/).

The app comes ready for deployment on [Heroku](http://heroku.com/), but being a
standard [node.js](http://nodejs.org/) app, it can be run pretty much anywhere.

See `config.json.example` for configuration information.

To use PostgreSQL support, provision a Heroku database with this schema:

```sql
CREATE TABLE "queue" (
  "filename" TEXT NOT NULL,
  PRIMARY KEY ("filename")
);
```

Author
------

[Tim De Pauw](http://tmdpw.eu/)

License
-------

Copyright &copy; 2014 Tim De Pauw

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
