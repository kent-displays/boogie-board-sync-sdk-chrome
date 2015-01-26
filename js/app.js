document.addEventListener('polymer-ready', function() {
  var pages = document.querySelector('core-animated-pages')
  var tabs = document.querySelector('paper-tabs')

  tabs.addEventListener('core-select', function () {
    pages.selected = tabs.selected
  })
})
