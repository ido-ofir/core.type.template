
module.exports = require('./template.js');

if(module.hot) {
    module.hot.accept('./template.js', function() {
        var plugin = require('./template.js');
        core.reloadPlugin(plugin);
    });
}