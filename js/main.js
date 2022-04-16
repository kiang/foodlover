var sidebar = new ol.control.Sidebar({ element: 'sidebar', position: 'right' });
var jsonFiles, filesLength, fileKey = 0;

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
for (var z = 0; z < 20; ++z) {
  // generate resolutions and matrixIds arrays for this WMTS
  resolutions[z] = size / Math.pow(2, z);
  matrixIds[z] = z;
}

var baseUrl = 'https://kiang.github.io/foodlover.tw/';

var filterPayment = {};
var filterCategory = '';
var filterArea = '';
function pointStyle(f) {
  var p = f.getProperties(), color = '#ceaf30', stroke, radius;
  if (filterPayment !== '' && p.pay_list.indexOf(filterPayment) === -1) {
    var paymentCheck = true;
    for(pay in filterPayment) {
      if(filterPayment[pay] && p.pay_list.indexOf(pay) === -1) {
        paymentCheck = false;
      }
    }
    if(!paymentCheck) {
      return null;
    }
  }
  if (filterCategory !== '' && p.category.indexOf(filterCategory) === -1) {
    return null;
  }
  if (filterArea !== '' && p.area.indexOf(filterArea) === -1) {
    return null;
  }
  if (f === currentFeature) {
    color = '#3c0';
    stroke = new ol.style.Stroke({
      color: '#000',
      width: 5
    });
    radius = 15;
  } else {
    stroke = new ol.style.Stroke({
      color: '#000',
      width: 2
    });
    radius = 10;
  }

  let pointStyle = new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius,
      fill: new ol.style.Fill({
        color: color
      }),
      stroke: stroke
    })
  });
  return pointStyle;
}
var sidebarTitle = document.getElementById('sidebarTitle');
var content = document.getElementById('infoBox');

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.721507, 23.700694]),
  zoom: 9
});

var pointFormat = new ol.format.GeoJSON({
  featureProjection: appView.getProjection()
});

var vectorPoints = new ol.layer.Vector({
  source: new ol.source.Vector({
    format: pointFormat
  }),
  style: pointStyle
});

var baseLayer = new ol.layer.Tile({
  source: new ol.source.WMTS({
    matrixSet: 'EPSG:3857',
    format: 'image/png',
    url: 'https://wmts.nlsc.gov.tw/wmts',
    layer: 'EMAP',
    tileGrid: new ol.tilegrid.WMTS({
      origin: ol.extent.getTopLeft(projectionExtent),
      resolutions: resolutions,
      matrixIds: matrixIds
    }),
    style: 'default',
    wrapX: true,
    attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
  }),
  opacity: 0.8
});

function countyStyle(f) {
  var p = f.getProperties();
  if (selectedCounty === p.COUNTYNAME) {
    return null;
  }
  var color = 'rgba(255,255,255,0.6)';
  var strokeWidth = 1;
  var strokeColor = 'rgba(0,0,0,0.3)';
  var cityKey = p.COUNTYNAME + "\n(請點選)";
  var textColor = '#000000';
  var baseStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: strokeColor,
      width: strokeWidth
    }),
    fill: new ol.style.Fill({
      color: color
    }),
    text: new ol.style.Text({
      font: '14px "Open Sans", "Arial Unicode MS", "sans-serif"',
      text: p.COUNTYNAME + "\n(請點選)",
      fill: new ol.style.Fill({
        color: textColor
      })
    })
  });
  return baseStyle;
}

var county = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'https://kiang.github.io/taiwan_basecode/county/topo/20200820.json',
    format: new ol.format.TopoJSON({
      featureProjection: appView.getProjection()
    })
  }),
  style: countyStyle,
  zIndex: 50
});


var map = new ol.Map({
  layers: [baseLayer, county, vectorPoints],
  target: 'map',
  view: appView
});

map.addControl(sidebar);
var pointClicked = false;
var selectedCounty = '';
var pointsPool = {};
var areasPool = {};
var updateAreas = function() {
  vectorPoints.getSource().forEachFeature(function(f) {
    var p = f.getProperties();
    if(!areasPool[p.area]) {
      areasPool[p.area] = true;
      $('#filterAreas').append('<a href="#" class="btn btn-secondary btn-lg btn-block filter-area" data-area="' + p.area + '">' + p.area + '</a>');
    }
  });
  $('a.filter-area').click(function () {
    var currentObj = $(this);
    $('a.filter-area').removeClass('btn-primary').addClass('btn-secondary');
    filterArea = currentObj.attr('data-area');
    currentObj.removeClass('btn-secondary').addClass('btn-primary');
    vectorPoints.getSource().refresh();
    sidebar.close();
  });
}
map.on('singleclick', function (evt) {
  content.innerHTML = '';
  pointClicked = false;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
    if (false === pointClicked) {
      pointClicked = true;
      var p = feature.getProperties();
      if (p.COUNTYNAME) {
        selectedCounty = p.COUNTYNAME;
        vectorPoints.getSource().clear();
        filterArea = '';
        areasPool = {};
        $('#filterAreas').html('<a href="#" class="btn btn-primary btn-lg btn-block filter-area" data-area="">全部顯示</a>');
        if (!pointsPool[selectedCounty]) {
          $.getJSON(baseUrl + selectedCounty + '.json', function (c) {
            pointsPool[selectedCounty] = c;
            vectorPoints.getSource().addFeatures(pointFormat.readFeatures(pointsPool[selectedCounty]));
            vectorPoints.getSource().refresh();
            updateAreas();
          });
        } else {
          vectorPoints.getSource().addFeatures(pointFormat.readFeatures(pointsPool[selectedCounty]));
          vectorPoints.getSource().refresh();
          updateAreas();
        }
        
        county.getSource().refresh();
      } else {
        currentFeature = feature;
        vectorPoints.getSource().refresh();
        var lonLat = ol.proj.toLonLat(p.geometry.getCoordinates());
        var message = '<table class="table table-dark">';
        message += '<tbody>';
        message += '<tr><th scope="row" style="width: 100px;">名稱</th><td>' + p.shop + '</td></tr>';
        message += '<tr><th scope="row" style="width: 100px;">支付方式</th><td>' + p.pay_list + '</td></tr>';
        message += '<tr><th scope="row" style="width: 100px;">類型</th><td>' + p.category + '</td></tr>';
        message += '<tr><th scope="row" style="width: 100px;">鄉鎮市區</th><td>' + p.area + '</td></tr>';
        message += '<tr><th scope="row" style="width: 100px;">住址</th><td>' + p.market_address + '</td></tr>';
        message += '<tr><td colspan="2">';
        message += '<hr /><div class="btn-group-vertical" role="group" style="width: 100%;">';
        message += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + lonLat[1] + ',' + lonLat[0] + '&travelmode=driving" target="_blank" class="btn btn-info btn-lg btn-block">Google 導航</a>';
        message += '<a href="https://wego.here.com/directions/drive/mylocation/' + lonLat[1] + ',' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Here WeGo 導航</a>';
        message += '<a href="https://bing.com/maps/default.aspx?rtp=~pos.' + lonLat[1] + '_' + lonLat[0] + '" target="_blank" class="btn btn-info btn-lg btn-block">Bing 導航</a>';
        message += '</div></td></tr>';
        message += '</tbody></table>';
        sidebarTitle.innerHTML = p.shop;
        content.innerHTML = message;
        sidebar.open('home');
      }
    }
  });
});

var previousFeature = false;
var currentFeature = false;

var geolocation = new ol.Geolocation({
  projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function (error) {
  console.log(error.message);
});

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
  image: new ol.style.Circle({
    radius: 6,
    fill: new ol.style.Fill({
      color: '#3399CC'
    }),
    stroke: new ol.style.Stroke({
      color: '#fff',
      width: 2
    })
  })
}));

var firstPosDone = false;
geolocation.on('change:position', function () {
  var coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
  if (false === firstPosDone) {
    map.dispatchEvent({
      type: 'singleclick',
      coordinate: coordinates,
      pixel: map.getPixelFromCoordinate(coordinates)
    });
    appView.setCenter(coordinates);
    firstPosDone = true;
  }
});

new ol.layer.Vector({
  map: map,
  source: new ol.source.Vector({
    features: [positionFeature]
  })
});

$('#btn-geolocation').click(function () {
  var coordinates = geolocation.getPosition();
  if (coordinates) {
    appView.setCenter(coordinates);
  } else {
    alert('目前使用的設備無法提供地理資訊');
  }
  return false;
});

$('a.filter-payment').click(function () {
  var currentObj = $(this);
  var selectedPayment = currentObj.attr('data-payment');
  if(selectedPayment === '') {
    filterPayment = {};
  } else if(filterPayment[selectedPayment]) {
    filterPayment[selectedPayment] = false;
  } else {
    filterPayment[selectedPayment] = true;
  }
  $('a.filter-payment').each(function() {
    var theObj = $(this);
    var cPayment = theObj.attr('data-payment');
    if(filterPayment[cPayment]) {
      theObj.removeClass('btn-secondary').addClass('btn-primary');
    } else {
      theObj.removeClass('btn-primary').addClass('btn-secondary');
    }
  });
  vectorPoints.getSource().refresh();
});

$('a.filter-category').click(function () {
  var currentObj = $(this);
  $('a.filter-category').removeClass('btn-primary').addClass('btn-secondary');
  filterCategory = currentObj.attr('data-category');
  currentObj.removeClass('btn-secondary').addClass('btn-primary');
  vectorPoints.getSource().refresh();
  sidebar.close();
});