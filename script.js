var A = L.marker([60, 60], { draggable: true });
var B = L.marker([60, -60], { draggable: true });
var line = L.geodesic();
var geodesicDistance;
var straightDistance;
var geodesicPopup;
var straightPopup;
var geodesicCoords;
var geodesicMidpoint;
var straightMidpoint;

const geodesic = L.geodesic([A.getLatLng(), B.getLatLng()], {
    weight: 3,
    color: 'red',
    steps: 6
}).bindPopup();

const straight = L.polyline([A.getLatLng(), B.getLatLng()], {
    weight: 3,
    color: 'green'
}).bindPopup();

A.on('drag', (e) => {
    geodesic.setLatLngs([e.latlng, B.getLatLng()])
    straight.setLatLngs([e.latlng, B.getLatLng()])
    updatePopups();
});
B.on('drag', (e) => {
    geodesic.setLatLngs([A.getLatLng(), e.latlng])
    straight.setLatLngs([A.getLatLng(), e.latlng])
    updatePopups();
});

function updatePopups() {
    geodesicCoords = geodesic.getLatLngs()[0];
    geodesicMidpoint = geodesicCoords[Math.floor(geodesicCoords.length / 2)];
    geodesicDistance = map.distance(A.getLatLng(), B.getLatLng());
    geodesicPopup = `
        <strong>Linia geodezyjna </strong><br>
        Długość: ${(geodesicDistance / 1000).toFixed(2)} km`;
    geodesic.getPopup().setContent(geodesicPopup).setLatLng(geodesicMidpoint);

    straightMidpoint = straight.getCenter();
    var zoom = map.getZoom();
    straightDistance = map.project(A.getLatLng()).distanceTo(map.project(B.getLatLng())) / 2 ** zoom * 40075 / 256;
    straightPopup = `
        <strong>Linia prosta </strong><br>
        Długość: ${(straightDistance).toFixed(2)} km`;
    straight.getPopup().setContent(straightPopup).setLatLng(straightMidpoint);
}

var center = new L.LatLng(52.237, 21.018);
var radii = [1000, 2000, 3000, 4000, 5000];
var circles = [];
for (let i = 0; i < radii.length; i++) {
    circles[i] = new L.GeodesicCircle(center, {
        radius: i*1000000,
        color: "#d73027",
        weight: 2,
        opacity: 0.5,
        steps: 1000,
    });
}
var C = L.marker(center, { draggable: true });
C.on('drag', (e) => {
    center = e.latlng;
    drawCircles();
});

function drawCircles() {
    for (let i = 0; i < radii.length; i++) {
        circles[i].setLatLng(center);
    }
}




var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});


var hillshade = L.tileLayer.wms('https://wms.gebco.net/mapserv', {
    layers: 'GEBCO_LATEST',
    attribution: 'GEBCO Compilation Group (2024) GEBCO 2024 Grid'
})

var satellite = L.tileLayer.wms('https://basemap.nationalmap.gov/arcgis/services/USGSImageryOnly/MapServer/WMSServer', {
    layers: '0',
    attribution: 'Tiles © Esri'
})

function style(feature) {
    var ratio = parseFloat(feature.properties["Merkator_ExportFeatu_Project.Ratio"]);

    var color;
    if (ratio < 1.5) {
        color = "#fee08b";
    } else if (ratio < 2.5) {
        color = "#fdae61";
    } else if (ratio < 5) {
        color = "#f46d43";
    } else if (ratio < 10) {
        color = "#d73027";
    } else {
        color = "#a50026";
    }

    return {
        fillColor: color,
        weight: 0,
        fillOpacity: 0.7
    };
}

function formatArea(area) {
    if (area < 1000) {
        return `${area.toFixed(2)} km²`;
    } else if (area < 1_000_000) {
        return `${(area / 1000).toFixed(2)} tys. km²`;
    } else {
        return `${(area / 1_000_000).toFixed(2)} mln km²`;
    }
}

var geoJSONLayer;
fetch("znieksztalcenia.geojson")
    .then(response => response.json())
    .then(data => {
        geoJSONLayer = L.geoJson(data, {
            style: style,
            onEachFeature: function (feature, layer) {
                var mercator = parseFloat(feature.properties["Merkator_ExportFeatu_Project.Shape_Area"]) / 10**6;
                var truearea = parseFloat(feature.properties["TrueArea_ExportFeatu_Project.Shape_Area"]) / 10**6;
                var ratio = parseFloat(feature.properties["Merkator_ExportFeatu_Project.Ratio"])
                var popupContent = `
                    <strong>${feature.properties["Merkator_ExportFeatu_Project.ADMIN"]}</strong><br>
                    Pole wg odwzorowania Mercatora: ${formatArea(mercator)}<br>
                    Rzeczywiste pole: ${formatArea(truearea)}<br>
                    Współczynnik zakłamania: ${ratio.toFixed(2)}
                `;
                layer.bindPopup(popupContent);
            }
        });
        overlayMaps["Mapa wskaźnika zaburzenia"] = geoJSONLayer;
        L.control.layers(baseMaps, overlayMaps).addTo(map);
        geoJSONLayer.addTo(map);
    });

var distanceLayer = L.layerGroup([A, B, geodesic, straight]);
var circlesLayer = L.layerGroup([...circles, C]);

var baseMaps = {
    "OpenStreetMap": osm,
    "Ukształtowanie terenu": hillshade,
    "Widok satelitarny": satellite
};

var overlayMaps = {
    "Porównanie odległości": distanceLayer,
    "Prawdziwe koła wokół punktu": circlesLayer,
    "Mapa wskaźnika zaburzenia": geoJSONLayer
};

var map = L.map('map', {
    center: [0, 0],
    zoom: 2,
    layers: [osm]
});

distanceLayer.on('add', function () {
    updatePopups();
    geodesic.getPopup().addTo(map).openPopup(geodesicMidpoint);
    straight.getPopup().addTo(map).openPopup(straightMidpoint);
});

circlesLayer.on('add', function () {
    drawCircles();
});