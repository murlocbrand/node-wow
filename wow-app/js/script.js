var fs = require('fs')
var addonList = $('#addon-list')

function createButton(icon) {
  var btn = $('<div />', {
    class : 'btn btn-default'
  })

  btn.append($('<i />').addClass('ion-' + icon))

  return btn
}

function createError(msg) {
  var div = $('<div />', { class : 'addon-item' })
  div.append($('<p />', { text : msg }))
  return div
}

function createSpinner() {
  var div = $('<div />', { class : 'spinner' })
  return div
}

function addElement(elem, delay) {
  elem.css('opacity', '0')
  elem.velocity({
    translateX: [0, -75],
    opacity : 1
  }, {
    duration: 400,
    delay: delay
  })

  // add to document
  addonList.append(elem)
}

var ipc = require('ipc');
var request = require('request');
var unzip = require('unzip')

$('#curDir').on('click', function () {
  var path = ipc.sendSync('request-wow-path', process.env.WOW_PATH || 'C:\\Program Files\\')
  if (path) {
    process.env.WOW_PATH = path
    $('#action-list').show()
    $('#curDir').text(path)
    updateAddOnList(path)
  } else
    $('#action-list').hide()
})

function getDownloadUrl(addon, callb) {
  var url = 'http://www.curse.com/addons/wow/' + addon + '/' + 'download'

  request.get(url, function(err, res, body) {
    if (err)
      callb('Connection error.')
    else
      callb(null, body)
  })
}

function parseDownloadLink(body) {
  try {

    var durl = /data-href="(http:\/\/addons\.curse\.cursecdn\.com\/files\/[^\n\"]*)"/.exec(body)[1]
    var version = parseInt(/data-file="([0-9]+)"/.exec(body)[1])

    return { url : durl, version : version }
  }
  catch (e) {
    return null
  }
}

// check version
function checkFileVersion(addon, ver, callb) {
  var self = this
  var fname = __dirname + '/../tmp/' + addon + '.' + ver + '.tmp'
  fs.exists(fname, function (has) {
    callb(has)
  })
}

function install(addon, index, version, data) {
  var cont = $('#addon-' + index)

  cont.velocity('stop')

  var fname = __dirname + '/../tmp/' + addon + '.' + version + '.tmp'
  fs.writeFile(fname, data, function (err, res) {
    if (err)
      console.log(addon, err)
    else
      extract(addon, index, version, fname)
  })
}

function extract(addon, index, version, fname) {
  var src = fs.createReadStream(fname)
  var dst = unzip.Extract({ path: process.env.WOW_PATH + '\\Interface\\AddOns\\' })
  var cont = $('#addon-' + index)

  cont.velocity({
    backgroundColor: "#aaaa00"
  }, {
    duration : 250,
    loop: true
  })

  src.pipe(dst)

  src.on('error', function (err) { console.log(err) })
  dst.on('error', function (err) { console.log(err) })

  dst.on('close', function () {
    cont.velocity('stop')
    flash(cont)
  })
}

function flash(cont) {
  cont.velocity({
    backgroundColor : ['#ffffff']
  }, {})
}

function processAddon(addon, index, forceInstall) {
  var cont = $('#addon-' + index)

  // Animate color
  cont.velocity({
    backgroundColor: "#00aa00"
  }, {
    duration : 500,
    loop: true
  })

  getDownloadUrl(addon, function (err, body) {
    if (err) {
      console.log(err)
      return
    }

    var dlInfo = parseDownloadLink(body)
    if (dlInfo) {
      cont.velocity('stop')
      checkFileVersion(addon, dlInfo.version, function (has) {
        if (!has || forceInstall) {

          if (has && forceInstall) {
            // if we have .tmp stored, use it instead of download
            extract(addon, index, dlInfo.version, __dirname + '/../tmp/' + addon + '.' + dlInfo.version + '.tmp')
          } else {
            // Do the actual download && extract
            cont.velocity({
              backgroundColor: "#00aa00"
            }, {
              duration : 200,
              loop: true
            })

            request({
              url : dlInfo.url,
              encoding : null
            }, function (err2, rep, data) {
              if (err2)
                console.log(err2)
              else
                install(addon, index, dlInfo.version, data)
            })
          }
        } else
          flash(cont)
      })
    } else {
      cont.velocity('stop')
      cont.remove()
      fs.readFile(process.env.WOW_PATH + '\\Interface\\AddOns\\addons.json', function (ex, dx){
        if (!ex) {
          dx = JSON.parse(dx)
          if (dx.addons.indexOf(addon) >= 0)
            dx.addons.splice(dx.addons.indexOf(addon), 1)
          fs.writeFile(process.env.WOW_PATH + '\\Interface\\AddOns\\addons.json', JSON.stringify(dx), function (e, r){})
        }
      })
    }
  })

}

function installAddOn(addon) {
  var fname = process.env.WOW_PATH + '\\Interface\\AddOns\\addons.json'

  fs.readFile(fname, function (err, cont) {
    if (err)
      fs.writeFile(fname, JSON.stringify({ "addons" : [addon] }), function (e, r) {
        if (e)
          console.log(e)

        addElement(createAddOn(addon, 0), 0)
        processAddon(addon, 0, true)
      })
    else {
      cont = JSON.parse(cont)
      cont.addons.push(addon)
      fs.writeFile(fname, JSON.stringify(cont), function (e, r) {
        if (e)
          console.log(e)

        addElement(createAddOn(addon, cont.addons.length - 1), 0)
        processAddon(addon, cont.addons.length - 1, true)
      })
    }
  })
}

var path = require("path");

var rmdir = function(dir) {
  var list = fs.readdirSync(dir);
  for(var i = 0; i < list.length; i++) {
    var filename = path.join(dir, list[i]);
    var stat = fs.statSync(filename);

    if(filename == "." || filename == "..") {
      // pass these files
    } else if(stat.isDirectory()) {
      // rmdir recursively
      rmdir(filename);
    } else {
      // rm fiilename
      fs.unlinkSync(filename);
    }
  }
  fs.rmdirSync(dir);
};

function updateAddOn(index, addon) {
  processAddon(addon, index)
}

function removeAddOn(addon, index) {
  var fname = process.env.WOW_PATH + '\\Interface\\AddOns\\addons.json'

  fs.readFile(fname, function (err, cont) {
    if (err) { console.log(err); return; }

    cont = JSON.parse(cont)
    var id = cont.addons.indexOf(addon)
    console.log(addon, id, index);
    cont.addons.splice(id, 1) // remove it

    fs.writeFile(fname, JSON.stringify(cont), function (e, r) {
      if (e) { console.log(e); return; }

      // open tmp file and find folder names
      fs.readdir(__dirname + '/../tmp/', function (ee, files) {
        var tmp = $.map(files, function (fadd, fi) {
          return fadd.indexOf(addon) >= 0 ? fadd : null
        })

        if (tmp) {
          console.log('found tmp', tmp)
          var dirs = []
          fs.createReadStream(__dirname + '/../tmp/' + tmp)
          .pipe(unzip.Parse())
          .on('entry', function (entry) {
            var fileName = entry.path;
            fileName = fileName.substring(0, fileName.indexOf('/'))

            if (dirs.indexOf(fileName) === -1)
              dirs.push(fileName)

            entry.autodrain();
          })
          .on('close', function (){
            $.each(dirs, function (folder_index, folder) {
              rmdir(process.env.WOW_PATH + '\\Interface\\AddOns\\' + folder)
            })
            $('#addon-' + index).remove()
          });
        }
      })
    })
  })
}

function forAllAddOns(func) {
  $('.addon-title')
  .map(function (index, div) {
    return $(div).text()
  })
  .each(func)
}

$('#ok-modal').on('click', function () {
  modal.hide()
  installAddOn($('#addon-name').val())
})

$('#close-modal').on('click', function () {
  modal.hide()
})

$('#install').on('click', function (){
  modal.show('#addon-popup')
})

$('#update-all').on('click', function (){
  forAllAddOns(updateAddOn)
})

function createAddOn(name, index) {
  var container = $('<div />', { class : 'addon-item', id : 'addon-' + index })

  var txtDiv = $('<div />', { class : 'addon-title' })
  var txt = $('<p />', { text : name })

  var buttonsDiv = $('<div />', { class : 'addon-actions'})
  var btnUpdate = createButton('android-arrow-down')
  var btnRemove = createButton('android-delete')

  btnUpdate.on('click', function (){
    updateAddOn(name, index)
  })

  btnRemove.on('click', function (){
    removeAddOn(name, index)
  })

  // setup
  txtDiv.append(txt)

  buttonsDiv.append(btnUpdate)
  buttonsDiv.append(btnRemove)

  // bootstrap
  container.append(txtDiv)
  container.append(buttonsDiv)

  return container
}

function showAddOnList(err, files) {
  addonList.children().remove()
  if (err) {
    $('#update-all').hide()
    addElement(createError(err), 0)
  } else {
    $('#update-all').show()
    files.forEach(function (fileName, index) {
      var container = createAddOn(fileName, index)
      addElement(container, index * 100)
    })
  }

}

function updateAddOnList(path) {
  var fullPath = path + '\\Interface\\AddOns\\'

  addonList.children().remove()
  addonList.append(createSpinner())

  fs.readdir(fullPath, function (dirErr, files) {
    if (dirErr) {
      showAddOnList('DIR:' + dirErr)
      $('#action-list').hide()
    } else
      fs.readFile(fullPath + 'addons.json', function (err, data) {
        $('#action-list').show()
        if (err)
          showAddOnList('No add-ons installed.')
        else
          try {
            var file = JSON.parse(data)
            showAddOnList(null, file.addons)
          } catch (e) {
            showAddOnList('CATCH:' + e)
          }
      })
  })
}

if (process.env.WOW_PATH)
  updateAddOnList(process.env.WOW_PATH)
else
  $('#action-list').hide()
