# icrawler

Tool for easy scraping data from websites

## Install

```bash
npm install icrawler
```

## Usage

```js
icrawler(startURL, opts, parse, done);
```

- **`startURL`** - URL of page for start crawling
- **`opts`** - options (is not optional yet)
- **`parse`** - page-parsing `function(url, $, _)` , that runs for every crawled page and gets this params:
    - `url` - url of parsed page
    - `$` - jQuery-like (`cheerio` powered) object for parsed page
    - `_` - object with four functions:
      - `_.push(url)` - adds new url to crawler queue (will be parsed later)
      - `_.save(item)` - adds parsed item to results array
      - `_.step()` - increment indicator
      - `_.log(message /*, ... */)` - safe logging (use it instead `console.log`)
- **`done`** - `function(result)`, that runs once with result of crawling/parsing

## Example

```js
var icrawler = require('icrawler');

icrawler(URL, null, function(url, $, _){
    if($('#next').length > 0){
        _.push($('.next').attr('href'));
        _.log('PAGE');
    }
    $('.news>a').each(function() {
        _.step();
        _.save({
            title: $(this).text(),
            href: $(this).attr('href')
        })
    });
}, function(result){
    console.log(result);
});
```

## License

MIT