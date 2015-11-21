var cheerio = require('cheerio');
var needle = require('needle');
var async = require('async');
var caba = require('caba')();

function filterOpts(opts){
    var type = Object.prototype.toString.call( [] ).slice(8,-1);
    if (type === 'String'){
        try {
            opts = JSON.parse(opts);
        } catch(e) {
            return {};
        }
    }
    if (type !== 'Object'){
        return {};
    }
    var o = {};
    if(opts.cookieSource){o.cookieSource = opts.cookieSource;}
    o.delay = opts.delay || 10000;
    return o;
}

module.exports = function(startURL, opts, parse, done){
    var result = [];
    opts = filterOpts(opts);
    caba.start('%s results found');

    var q = async.queue(function(url, cb){
        needle.get(url, opts, function(err, res){
            if (!err && res.statusCode === 200) {
                if (opts.cookieSource && url === opts.cookieSource) {
                    opts.cookies = res.cookies;
                } else {
                    parse(url, cheerio.load(res.body), {
                        push: q.push,
                        save: function(v){result.push(v);},
                        step: caba.step,
                        log: caba.log
                    });
                }
            } else {
                caba.log('Error:', url);
                if (!q.paused) {
                    q.pause();
                    caba.log('Paused!', new Date());
                    setTimeout(function(){
                        if (opts.cookieSource) {
                            q.unshift(opts.cookieSource);
                        }
                        q.resume();
                        caba.log('Resumed!', new Date());
                    }, opts.delay);
                }
                q.push(url);
            }
            cb();
        });
    });

    q.drain = function(){
        caba.finish();
        done(result);
    };

    if (opts.cookieSource) {
        q.push(opts.cookieSource);
    }
    q.push(startURL);
};