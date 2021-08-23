
angular.module('gaugesScreen', [])
.directive('bngMapRenderUncompressed', function () {
  return {
    template: `<svg width="100%" height="100%" class="container"></svg>`,
    scope: {
      map: '<',
      color: '@?',
      width: '@?',
      drivability: '@?'
    },
    replace: true,
    restrict: 'E',
    link: function (scope, element, attrs) {
      "use strict";
      var svg = element[0]
        , mapScale = 1
        , domElems = {}
        , getColor = (rClass) => scope.color || (rClass === 0 ? 'black' : 'white') // if there is a color set use that otherwise use the defaults
        ;


      function isEmpty (obj) {
        return Object.keys(obj).length === 0;
      }

      function calcRadius (radius) {
        return  Math.min(Math.max(radius, 0), 5) * 3
      }

      scope.$watch('map', function (newVal) {
        if (newVal && !isEmpty(newVal)) {
          setupMap(newVal, angular.element(svg));
        }
      })

      function _createLine(p1, p2, color) {
         return hu('<line>', svg).attr({
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          stroke: color,
          strokeWidth: Math.max(p1.radius, p2.radius),
          strokeLinecap: "round",
        });
      }

      function drawRoads(nodes, drivabilityMin, drivabilityMax) {
        var drawn = {};
        for (var key in nodes) {
          var el = nodes[key];
          // walk the links of the node
          if (el.links !== undefined) { // links
            for (var key2 in el.links) {
              var el2 = nodes[key2];
              var drivability = el.links[key2].drivability;
              if (el2 !== undefined) {
                if (drivability >= drivabilityMin && drivability <= drivabilityMax) {
                  // TODO: can we find a better key here please?
                  drawn[key + '.' + key2 + drivabilityMin + drivabilityMax] = true;
                  if (domElems[key + '.' + key2 + drivabilityMin + drivabilityMax] !== undefined) {
                    domElems[key + '.' + key2 + drivabilityMin + drivabilityMax].remove();
                  }
                  domElems[key + '.' + key2 + drivabilityMin + drivabilityMax] = _createLine({
                    x: el.pos[0] / mapScale,
                    y: -el.pos[1] / mapScale,
                    radius: calcRadius(el.radius)
                  }, {
                      x: el2.pos[0] / mapScale,
                      y: -el2.pos[1] / mapScale,
                      radius: calcRadius(el2.radius)    // prevents massive blobs due to waypoints having larger radius'
                    }, getColor(drivability)
                  );
                }
              }
            }
          }
        }

        // remove all elems that are from previous calls
        for (var key in domElems) {
          if (!drawn[key] && key.endsWith('' + drivabilityMin + drivabilityMax)) {
            domElems[key].remove()
            domElems[key] = undefined; // delete domNode reference and allow for gc
          }
        }
      }

      function setupMap(data) {
        if (data != null) {

          svg.setAttribute('viewBox', data.viewParams.join(' '));

          // draw dirt roads and then normal on top
          if (scope.drivability !== 'false') {
            drawRoads(data.nodes, 0, 0.9);
            drawRoads(data.nodes, 0.9, 1);
          } else {
            drawRoads(data.nodes, 0, 1);
          }
        }
      }
    }
  };
})

  .controller('GaugesScreenController', function ($scope, $element, $window) {
    "use strict";
    var vm = this;

    var svg;
    var navContainer = $element[0].children[0];
    var navDimensions = [];

    var speedoDisplay = { gears: {} };
    var tacho = {  };
    var navDisplay = {};
    var infoDisplay = {};
    var consumGraph = {values:{current: 0,avg: 0}};
    var electrics = {lights:{} };
    var gagues = {fuel:{},temp:{}};

    var backgroundGradient = {};
    var overlayGradient = {};
    var navMarkerGradient = {};
    // var backgroundClipGradient;

    var speedoInitialised = true;
    var currentGear = '';
    var cachedAng = {speedo:-100, tacho:-100, temp:-100, fuel:-100};
    var refreshAng = 0.25*Math.PI/180;

    var ready = false;

    var unit = "metric";
    var unitspeedConv = 3.6;
    var unitspeedratio = 2.0*Math.PI*1.5/260;
    var rpmRatio = 0.1;

    var painduchocolat = {}; //une tradi bien cuite s'il vous plait

    // Make sure SVG is loaded
    $scope.onSVGLoaded = function () {
      svg = $element[0].children[0].children[0];

      painduchocolat.root = hu('#layer_wip', svg);
      painduchocolat.txt = hu('#wip.txt', painduchocolat.root);

      // speedometer
      speedoDisplay.root = hu('#speedometer', svg);
      speedoDisplay.speedometerText = hu('#speedometerText', speedoDisplay.root)
      speedoDisplay.speedValue = hu('#speedValue', speedoDisplay.speedometerText);
      speedoDisplay.speedUnit = hu('#speedUnit', speedoDisplay.speedometerText);
      speedoDisplay.speedTicks = hu('#speedTicks', speedoDisplay.speedometerText);
      speedoDisplay.speedTicks.css({'stroke': `rgba(255, 255, 255, 0.5)`, 'stroke-width': '0.5px'});
      speedoDisplay.speedTicksText  = hu('#speedTicksText', speedoDisplay.speedometerText);
      speedoDisplay.gears.root = hu('#gears_layer', svg);
      speedoDisplay.gears.P = hu('#gearP', speedoDisplay.gears.root);
      speedoDisplay.gears.R = hu('#gearR', speedoDisplay.gears.root);
      speedoDisplay.gears.N = hu('#gearN', speedoDisplay.gears.root);
      speedoDisplay.gears.D = hu('#gearD', speedoDisplay.gears.root);
      //speedoDisplay.gears.S = hu('#gearS', speedoDisplay.gears.root);
      speedoDisplay.needle = hu('#needle', speedoDisplay.root);
      //speedoDisplay.needle.css({transformOrigin: '68px 33px', transform: 'rotate(227deg)'}).attr({class: "fade-in"});
      //speedoDisplay.needle.attr({class: "fade-in"});
      speedoDisplay.needle_bar = hu('#needle_bar', speedoDisplay.root);
      //speedoDisplay.needle_bar.attr({class: "fade-in"});
      speedoDisplay.needle_gradients = [];
      speedoDisplay.needle_gradients.push(hu('#radialGradient965', svg));
      speedoDisplay.needle_lingradient = hu('#linearGradient1357', svg);
      speedoDisplay.needle_bar_highlight = hu('#needle_bar_highlight', speedoDisplay.root);
      speedoDisplay.needle_bar_highlightGrad = hu('#linearGradient1390', svg);

      tacho.root = hu('#tacho', svg);
      tacho.bar = hu('#rpm_needle_bar', tacho.root);
      tacho.needle = hu('#rpm_needle', tacho.root);
      tacho.Ticks = hu('#rpmTicks', tacho.root);
      tacho.Ticks.css({'stroke': `rgba(255, 255, 255, 0.5)`, 'stroke-width': '0.5px'});
      tacho.TicksText  = hu('#rpmTicksText', tacho.root);
      tacho.needle_gradients = [];
      //tacho.needle_gradients.push(hu('#radialGradient965-1', svg));
      //tacho.needle_lingradient = hu('#linearGradient1369', svg);
      tacho.rpm_needle_bar_highlight  = hu('#rpm_needle_bar_highlight', tacho.root);
      tacho.rpm_needle_bar_highlightGrad = hu('#linearGradient1392', svg);
      tacho.pwr_charg_path = hu('#pwr_charg_path', tacho.root);
      tacho.pwr_eco_path = hu('#pwr_eco_path', tacho.root);
      tacho.pwr_pwr_path = hu('#pwr_pwr_path', tacho.root);
      tacho.pwr_arcpath = hu('#pwr_arcpath', tacho.root);
      tacho.pwr_arctext = hu('#pwr_arctext', tacho.root);
      tacho.pwr_charg_slice = hu('#pwr_charg_slice', tacho.root);
      tacho.pwr_eco_slice = hu('#pwr_eco_slice', tacho.root);
      tacho.pwr_pwr_slice = hu('#pwr_pwr_slice', tacho.root);

      gagues.root = hu('#gagues', svg);
      gagues.fuel.low = hu('#fuelBar1', gagues.root);
      gagues.fuel.normal = hu('#fuelBar2', gagues.root);

      gagues.temp.low = hu('#tempBar1', gagues.root);
      gagues.temp.normal = hu('#tempBar2', gagues.root);
      gagues.temp.high = hu('#tempBar3', gagues.root);

      // nav
      // navDisplay.root = hu('#navigation', svg);
      // navDisplay.overlay = hu('#MapOverlay', navDisplay.root);


      //speedoDisplay.speedometerText.attr({class: "grow"})
      // infoDisplay.root.attr({class: "slide-right"});
      // navDisplay.root.attr({class: "slide-left"});
      // var background = hu('#background', svg);
      // background.attr({class: 'map-fade'})

      electrics.root = hu('#lights_layer', svg);
      electrics.lights.signal_L = hu("#light_signal_L", electrics.root);
      electrics.lights.signal_R = hu("#light_signal_R", electrics.root);
      electrics.lights.lights = hu("#light_lights", electrics.root);
      electrics.lights.highbeam = hu("#light_highbeam", electrics.root);
      electrics.lights.fog = hu("#light_fog", electrics.root);
      electrics.lights.lowpressure = hu("#light_lowpressure", electrics.root);
      electrics.lights.parkingbrake = hu("#light_parkingbrake", electrics.root);
      electrics.lights.checkengine = hu("#light_checkengine", electrics.root);
      electrics.lights.hazard = hu("#light_hazard", electrics.root);
      electrics.lights.lowfuel = hu("#lights_battery", electrics.root);
      electrics.lights.cruiseControlActive = hu("#light_cruise", electrics.root);

      electrics.lights_fog_front = hu("#light_fog_front", electrics.root);
      electrics.esc = hu("#light_escActive", electrics.root);
      electrics.tcs = hu("#light_tcsActive", electrics.root);
      electrics.battery_txt = hu("#battery_txt", electrics.root);
      electrics.bat_stop1 = hu("#stop5609", svg);
      electrics.bat_stop2 = hu("#stop5611", svg);
      electrics.bat_stop3 = hu("#stop5605", svg); //begin

      electrics.temp_env_txt = hu("#temp_txt", electrics.root);
      electrics.mode_txt = hu("#mode_txt", electrics.root);
    }

    function updateGearIndicator(data) {
      // only update when gear is changed
      if (currentGear !== data.electrics.gear) {
        currentGear = data.gear;
        var xct = 0;
        for (var key in speedoDisplay.gears) {
          if (key === data.electrics.gear) {
            speedoDisplay.gears[key].css({ fill: '#FFFFFF', "font-size": "12px", "transform": "translate(0px, 0px)" });
            xct += 4;
          }
          else {
            speedoDisplay.gears[key].css({ fill: '#616161', "font-size": "6.35px", "transform": "translate("+xct+"px, 0px)"});
          }
        }
      }
    }

    function updateSpeedDisplays(data) {
      if (speedoInitialised) {
        var speedAng = 226 + ((data.electrics.wheelspeed * 2.35));
        var startAngle=-180*Math.PI/180, speedRad = (data.electrics.wheelspeed*unitspeedratio)+startAngle;
        var maxRad = (150*Math.PI/180) + startAngle;
        speedRad = Math.min(speedRad, maxRad);
        //console.log("maxRad",maxRad,"rad",speedRad,"rad-start",speedRad-startAngle, "deg",(speedRad-startAngle)*180/Math.PI);
        speedoDisplay.speedValue.text((data.electrics.wheelspeed * unitspeedConv ).toFixed(0));
        if(Math.abs(speedRad-cachedAng.speedo)<refreshAng){return;}
        cachedAng.speedo = speedRad;

        var centerX=203.5, centerY=57.5, radiusInt=15, radiusExt=47, largeArcFlag= ((speedRad-startAngle)>Math.PI)? 0 : 0, radiusExtH = radiusExt-1 ;
        //console.log("startAngle",startAngle,"speedRad",speedRad,"largeArcFlag",largeArcFlag);
        var sx2 = (centerX) + Math.cos(startAngle) * radiusInt;
        var sy2 = (centerY) + Math.sin(startAngle) * radiusInt;

        var sx1 = (centerX) + Math.cos(startAngle) * radiusExt;
        var sy1 = (centerY) + Math.sin(startAngle) * radiusExt;

        var ex2 = (centerX) + Math.cos(speedRad) * radiusExt;
        var ey2 = (centerY) + Math.sin(speedRad) * radiusExt;

        var ex1 = (centerX) /*+ Math.cos(speedRad) * radiusInt*/;
        var ey1 = (centerY) /*+ Math.sin(speedRad) * radiusInt*/;

        var mx1 = (centerX) + Math.cos(speedRad) * 0;
        var my1 = (centerY) + Math.sin(speedRad) * 0;

        speedoDisplay.needle_bar.attr({d: "M " + sx1 + "," + sy1 +
          " A" + radiusExt  + "," + radiusExt  + " 0 "+largeArcFlag+",1 " + ex2 + "," + ey2 +
          " L " + ex1 + "," + ey1 /*+
      " A" + radiusInt + "," + radiusInt + " 0 "+largeArcFlag+",0 " + sx2 + "," + sy2*/});
        speedoDisplay.needle.attr({d: "M " + ex1 + "," + ey1 + " " +ex2+","+ey2});
        speedoDisplay.needle_lingradient.attr({x1: ex1, y1: ey1, x2: ex2, y2: ey2});


        ex2 = (centerX) + Math.cos(speedRad) * radiusExtH;
        ey2 = (centerY) + Math.sin(speedRad) * radiusExtH;

        ex1 = (centerX) + Math.cos(startAngle) * radiusExtH;
        ey1 = (centerY) + Math.sin(startAngle) * radiusExtH;
        speedoDisplay.needle_bar_highlight.attr({d: "M " + ex1 + "," + ey1 +
        " A" + radiusExtH  + "," + radiusExtH  + " 0 "+largeArcFlag+",1 " + ex2 + "," + ey2});
        speedoDisplay.needle_bar_highlightGrad.attr({x1: ex1, y1: ey1, x2: ex2, y2: ey2});


        for(var E in speedoDisplay.needle_gradients){
          //console.log(speedoDisplay.needle_gradients[E].n.gradientTransform, typeof(speedoDisplay.needle_gradients[E].n.gradientTransform));
          speedoDisplay.needle_gradients[E].n.gradientTransform.baseVal[0].matrix.e = ex2;
          speedoDisplay.needle_gradients[E].n.gradientTransform.baseVal[0].matrix.f = ey2;
          //speedoDisplay.needle_gradients[E].attr({cx:40,cy:40,fx:0,fy:0});
        }

      }
    }

    function updateTachoDisplays(data) {
      if (speedoInitialised) {
        var startAngle=-50*Math.PI/180, speedRad = (data["electrics"]["pwr"] * (data["electrics"]["pwr"]>0?2:1) * Math.PI/-3.62 )+startAngle;
        var maxRad = (-150*Math.PI/180) + startAngle;
        speedRad = Math.max(speedRad, maxRad);
        if(Math.abs(speedRad-cachedAng.tacho)<refreshAng){return;}
        cachedAng.tacho = speedRad;
        //console.log("maxRad",maxRad,"start",startAngle,"rad",speedRad,"rad-start",speedRad-startAngle, "deg",(speedRad-startAngle)*180/Math.PI);

        var centerX=67.7, centerY=57.5, radiusInt=36, radiusExt=47, radiusExtS = 50;
        //console.log("startAngle",startAngle,"speedRad",speedRad,"largeArcFlag",largeArcFlag);
        var six = (centerX) + Math.cos(startAngle) * radiusInt;
        var siy = (centerY) + Math.sin(startAngle) * radiusInt;
        var sex = (centerX) + Math.cos(startAngle) * radiusExtS;
        var sey = (centerY) + Math.sin(startAngle) * radiusExtS;

        var mix = (centerX) + Math.cos((-50*Math.PI/180) + startAngle) * radiusInt;
        var miy = (centerY) + Math.sin((-50*Math.PI/180) + startAngle) * radiusInt;
        var mex = (centerX) + Math.cos((-50*Math.PI/180) + startAngle) * radiusExtS;
        var mey = (centerY) + Math.sin((-50*Math.PI/180) + startAngle) * radiusExtS;

        var nix = (centerX) + Math.cos(speedRad) * (radiusInt-1);
        var niy = (centerY) + Math.sin(speedRad) * (radiusInt-1);
        var nex = (centerX) + Math.cos(speedRad) * radiusExt;
        var ney = (centerY) + Math.sin(speedRad) * radiusExt;


        tacho.needle.attr({d: "M " + nix + "," + niy + " " +nex+","+ney});
        //tacho.needle_lingradient.attr({x1: cix, y1: ciy, x2: cex, y2: cey});

        var cix = (centerX) + Math.cos(speedRad) * radiusInt;
        var ciy = (centerY) + Math.sin(speedRad) * radiusInt;
        var cex = (centerX) + Math.cos(speedRad) * radiusExtS;
        var cey = (centerY) + Math.sin(speedRad) * radiusExtS;

        if(data["electrics"]["pwr"] < 0){ //charge only
          tacho.pwr_charg_path.attr({d: "M " + cix + "," + ciy +
          " A" + radiusInt  + "," + radiusInt  + " 0 0,0 " + six + "," + siy});
          tacho.pwr_eco_path.attr({d: "M 0,0"});
          tacho.pwr_pwr_path.attr({d: "M 0,0"});
          tacho.needle.css({stroke:"#63b418"});
          tacho.pwr_charg_slice.attr({d: "M " + cix + "," + ciy +
            " A" + radiusInt  + "," + radiusInt  + " 0 0,0 " + six + "," + siy+
            " L " + sex + "," + sey +
            " A" + radiusExt  + "," + radiusExt  + " 0 0,1 " + cex + "," + cey +
            " L " + cix + "," + ciy
          });
          tacho.pwr_eco_slice.attr({d: "M 0,0"});
          tacho.pwr_pwr_slice.attr({d: "M 0,0"});
        }else{
          tacho.pwr_charg_path.attr({d: "M 0,0"});
          tacho.pwr_charg_slice.attr({d: "M 0,0"});
          if(data["electrics"]["pwr"] < 0.5){ //eco only
            tacho.pwr_eco_path.attr({d: "M " + cix + "," + ciy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + six + "," + siy});
            tacho.pwr_pwr_path.attr({d: "M 0,0"});
            tacho.needle.css({stroke:"#0098aa"})
            tacho.pwr_eco_slice.attr({d: "M " + cix + "," + ciy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + six + "," + siy+
              " L " + sex + "," + sey +
              " A" + radiusExt  + "," + radiusExt  + " 0 0,0 " + cex + "," + cey +
              " L " + cix + "," + ciy
            });
          tacho.pwr_pwr_slice.attr({d: "M 0,0"});
          }else{
            tacho.pwr_eco_path.attr({d: "M " + mix + "," + miy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + six + "," + siy});
            tacho.pwr_pwr_path.attr({d: "M " + cix + "," + ciy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + mix + "," + miy});
            tacho.needle.css({stroke:"#aee3e9"})
            tacho.pwr_eco_slice.attr({d: "M " + mix + "," + miy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + six + "," + siy+
              " L " + sex + "," + sey +
              " A" + radiusExt  + "," + radiusExt  + " 0 0,0 " + mex + "," + mey +
              " L " + mix + "," + miy
            });
            tacho.pwr_pwr_slice.attr({d: "M " + cix + "," + ciy +
              " A" + radiusInt  + "," + radiusInt  + " 0 0,1 " + mix + "," + miy+
              " L " + mex + "," + mey +
              " A" + radiusExt  + "," + radiusExt  + " 0 0,0 " + cex + "," + cey +
              " L " + cix + "," + ciy
            });
          }
        }

        // ex2 = (centerX) + Math.cos(speedRad) * radiusExtH;
        // ey2 = (centerY) + Math.sin(speedRad) * radiusExtH;

        // ex1 = (centerX) + Math.cos(startAngle) * radiusExtH;
        // ey1 = (centerY) + Math.sin(startAngle) * radiusExtH;
        /*tacho.rpm_needle_bar_highlight.attr({d: "M " + ex1 + "," + ey1 +
        " A" + radiusExtH  + "," + radiusExtH  + " 0 "+largeArcFlag+",0 " + ex2 + "," + ey2});
        tacho.rpm_needle_bar_highlightGrad.attr({x1: ex1, y1: ey1, x2: ex2, y2: ey2});*/

        /*for(var E in tacho.needle_gradients){
          tacho.needle_gradients[E].n.gradientTransform.baseVal[0].matrix.e = ex2;
          tacho.needle_gradients[E].n.gradientTransform.baseVal[0].matrix.f = ey2;
        }*/
      }
    }

    function limitVal(min, val,max){
        return Math.min(Math.max(min,val), max);
    }

    function updateAccelerometer(data) {
      infoDisplay.accelerometer.css({opacity: 1})
      infoDisplay.accelerometerMarker.css({transformOrigin: '50% 50%', transform: `translate(${limitVal(-10,data.sensors.gx2,10)/1.4}px, ${-limitVal(-10,data.sensors.gy2,10)/1.4}px`})
      var roundedGX2 = (data.sensors.gx2 / 10).toFixed(1);
      var roundedGY2 = (-data.sensors.gy2 / 10).toFixed(1);
      infoDisplay.gXPositive.text(roundedGX2 > 0 ? roundedGX2  : 0)
      infoDisplay.gXNegative.text(roundedGX2 < 0 ? -roundedGX2 : 0)
      infoDisplay.gYNegative.text(roundedGY2 > 0 ? roundedGY2  : 0)
      infoDisplay.gYPositive.text(roundedGY2 < 0 ? -roundedGY2 : 0)
    }

    $window.redrawSpeedoTicks = (lim,bigSep,smallSep) => {
      var startAngle=-180*Math.PI/180;
      var maxAngle = 150;
      var centerX=203.5, centerY=57.5, radiusInt=33.5, radiusExt=35, radiusIntBig=33.5;

      unitspeedratio = maxAngle*Math.PI/(lim*180)*unitspeedConv;
      var tickD = "";
      for(var ib = 0; ib<= (lim/bigSep) ; ib++){
        for(var is = 0; is<= (bigSep/smallSep); is++){
          var curAng = (ib*maxAngle/(lim/bigSep)+maxAngle*(1/(lim/bigSep))*(is/(bigSep/smallSep))) *Math.PI/180;
          if(curAng > (maxAngle*Math.PI/180)){break;}
          //console.log( (ib*270/(lim/bigSep)+270*(1/(lim/bigSep))*(is/(bigSep/smallSep))) , curAng);
          //console.log( "b=", ib*270/(lim/bigSep) , "s=", 270*(1/(lim/bigSep))*(is/(bigSep/smallSep)))
          var sx2 = (centerX) + Math.cos(startAngle+curAng) * (is===0?radiusIntBig:radiusInt);
          var sy2 = (centerY) + Math.sin(startAngle+curAng) * (is===0?radiusIntBig:radiusInt);

          var sx1 = (centerX) + Math.cos(startAngle+curAng) * radiusExt;
          var sy1 = (centerY) + Math.sin(startAngle+curAng) * radiusExt;
          tickD += "M "+(sx1)+","+(sy1)+" "+(sx2)+","+(sy2)+" ";
        }
      }
      var txtRadius = 41;
      speedoDisplay.speedTicks.attr({d: tickD});
      var fontSize = 5;
      if(lim/bigSep > 12){
        fontSize = fontSize * (10/ (lim/bigSep)) ;
      }
      //console.log("fontSize",fontSize,"r", (12/ lim/bigSep), "lim", lim, "bigSep", bigSep);
      var testStyle = {"font-size":fontSize+"px","font-style":"normal","font-weight":"bold","font-stretch":"normal","font-family":"Nasalization","fill":"#ffffff","fill-opacity":1,"stroke-width":0.04861574,"text-align":"center","text-anchor":"middle"};
      speedoDisplay.speedTicksText.empty();
      for(var ib = 0; ib<=(lim/bigSep) ; ib++){
        var curAng = (ib*maxAngle/(lim/bigSep)) *Math.PI/180;
        var sx = (centerX) + Math.cos(startAngle+curAng) * txtRadius;
        var sy = (centerY + 0.90) + Math.sin(startAngle+curAng) * txtRadius;
        var ts = hu('<tspan>', speedoDisplay.speedTicksText)
        .attr({x: sx,y: sy})
        .text((ib*bigSep))
        .css(testStyle);
      }
    }


    $window.redrawTachoTicks = (lim,bigSep,smallSep,red) => {
      var startAngle=0;
      var maxAngle = -150;
      var centerX=67.7, centerY=57.5, radiusInt=34, radiusExt=38, radiusTxt=38;
      rpmRatio = maxAngle*Math.PI/(lim*180);

      var tickD = "";
      for(var ib = 0; ib<= (lim/bigSep) ; ib++){
        for(var is = 0; is<= (bigSep/smallSep); is++){
          var curAng = (ib*maxAngle/(lim/bigSep)+maxAngle*(1/(lim/bigSep))*(is/(bigSep/smallSep))) *Math.PI/180;
          if(curAng < (maxAngle*Math.PI/180)){break;}
          //console.log( (ib*270/(lim/bigSep)+270*(1/(lim/bigSep))*(is/(bigSep/smallSep))) , curAng);
          //console.log( "b=", ib*270/(lim/bigSep) , "s=", 270*(1/(lim/bigSep))*(is/(bigSep/smallSep)))
          var sx2 = (centerX) + Math.cos(startAngle+curAng) * radiusInt;
          var sy2 = (centerY) + Math.sin(startAngle+curAng) * radiusInt;

          var sx1 = (centerX) + Math.cos(startAngle+curAng) * radiusExt;
          var sy1 = (centerY) + Math.sin(startAngle+curAng) * radiusExt;
          tickD += "M "+(sx1)+","+(sy1)+" "+(sx2)+","+(sy2)+" ";
        }
      }
      var txtRadius = 41;
      tacho.Ticks.attr({d: tickD});
      var testStyle = {"font-style":"normal","font-weight":"bold","font-stretch":"normal","font-family":"Nasalization","fill-opacity":1,"stroke-width":0.04861574,"text-align":"center","text-anchor":"middle"};
      tacho.TicksText.empty();
      /*for(var ib = 0; ib<=(lim/bigSep) ; ib++){
        var curAng = (ib*maxAngle/(lim/bigSep)) *Math.PI/180;
        var sx = (centerX) + Math.cos(startAngle+curAng) * txtRadius;
        var sy = (centerY + 0.90) + Math.sin(startAngle+curAng) * txtRadius;
        var ts = hu('<tspan>', tacho.TicksText)
        .attr({x: sx,y: sy})
        .text((ib*bigSep*0.001))
        .css(testStyle)
        .css({"fill":(ib*bigSep >= red)?"#ef3535":"#fff"});
      }*/

      var mAng = maxAngle *Math.PI/180;
      var sx1 = (centerX) + Math.cos(startAngle) * radiusInt;
      var sy1 = (centerY) + Math.sin(startAngle) * radiusInt;

      var ex2 = (centerX) + Math.cos(mAng) * radiusInt;
      var ey2 = (centerY) + Math.sin(mAng) * radiusInt;

      tacho.pwr_arcpath.attr({d: "M " + sx1 + "," + sy1 +
      " A" + radiusInt  + "," + radiusInt  + " 0 0,0 " + ex2 + "," + ey2});

      sx1 = (centerX) + Math.cos(startAngle) * radiusTxt;
      sy1 = (centerY) + Math.sin(startAngle) * radiusTxt;
      ex2 = (centerX) + Math.cos(mAng) * radiusTxt;
      ey2 = (centerY) + Math.sin(mAng) * radiusTxt;

      tacho.pwr_arctext.attr({d: "M " + ex2 + "," + ey2 +
      " A" + radiusTxt  + "," + radiusTxt  + " 0 0,1 " + sx1 + "," + sy1});


    }

    function updateGagueFuel(data) {
      if (speedoInitialised) {
        var speedAng = 226 + ((data["electrics"]["fuel"] * 0.05));
        var startAngle=90*Math.PI/180;
        var maxRad = (-180*Math.PI/180) + startAngle;
        var speedRad = (-data["electrics"]["fuel"]*Math.PI + startAngle );
        var lowRad = -22.5*Math.PI/180;
        //speedRad = Math.max(speedRad, maxRad);
        //console.log("maxRad",maxRad,"start",startAngle,"rad",speedRad,"rad-start",speedRad-startAngle, "deg",(speedRad-startAngle)*180/Math.PI);
        //speedoDisplay.needle.css({transform: `rotate(${speedAng}deg)` });
        if(Math.abs(speedRad-cachedAng.fuel)<refreshAng*4){return;}
        cachedAng.fuel = speedRad;

        var centerX=116.1, centerY=22.5, radius=12,largeArcFlag= ((speedRad-startAngle)>Math.PI)? 1 : 0;
        //console.log("startAngle",startAngle,"speedRad",speedRad,"largeArcFlag",largeArcFlag);


        var sx1 = (centerX) + Math.cos(startAngle) * radius;
        var sy1 = (centerY) + Math.sin(startAngle) * radius;
        var ex1 = (centerX) + Math.cos(startAngle+lowRad) * radius;
        var ey1 = (centerY) + Math.sin(startAngle+lowRad) * radius;

        var sx2 = (centerX) + Math.cos(startAngle+lowRad) * radius;
        var sy2 = (centerY) + Math.sin(startAngle+lowRad) * radius;
        var ex2 = (centerX) + Math.cos(speedRad) * radius;
        var ey2 = (centerY) + Math.sin(speedRad) * radius;

        if(data["electrics"]["fuel"] > 0.125){
          gagues.fuel.low.attr({d: "M " + sx1 + "," + sy1 +
            " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",0 " + ex1 + "," + ey1
          });
          gagues.fuel.normal.attr({d: "M " + sx2 + "," + sy2 +
            " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",0 " + ex2 + "," + ey2
          });
        }else{
          gagues.fuel.low.attr({d: "M " + sx1 + "," + sy1 +
            " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",0 " + ex2 + "," + ey2
          });
          gagues.fuel.normal.attr({d: "M " + sx2 + "," + sy2 +
            " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",0 " + sx2 + "," + sy2
          });
        }
      }
    }

    function updateGagueTemp(data) {
      if (speedoInitialised) {
        var startAngle=-90*Math.PI/180;
        var maxRad = -Math.PI*0.5+startAngle;
        var minRad = (-45*Math.PI/180) + startAngle;
        var redRad = (-135*Math.PI/180) + startAngle;
        var speedRad = (-(data["electrics"]["watertemp"]-50)* Math.PI /(80));
        speedRad = Math.max(speedRad, maxRad);
        speedRad = Math.min(speedRad, 0);
        //console.log("maxRad",maxRad,"start",startAngle,"rad",speedRad,"rad-start",speedRad-startAngle, "deg",(speedRad)*180/Math.PI);
        //speedoDisplay.needle.css({transform: `rotate(${speedAng}deg)` });
        if(Math.abs(speedRad-cachedAng.temp)<refreshAng*4){return;}
        cachedAng.temp = speedRad;

        var centerX=155.1, centerY=22.5, radius=12,largeArcFlag= ((speedRad-startAngle)>Math.PI)? 1 : 0;
        //console.log("startAngle",startAngle,"speedRad",speedRad,"largeArcFlag",largeArcFlag);
        var sx = (centerX) + Math.cos(startAngle) * radius;
        var sy = (centerY) - Math.sin(startAngle) * radius;


        var mx = (centerX) + Math.cos(minRad) * radius;
        var my = (centerY) - Math.sin(minRad) * radius;
        var rx = (centerX) + Math.cos(redRad) * radius;
        var ry = (centerY) - Math.sin(redRad) * radius;

        var cx = (centerX) + Math.cos(speedRad+startAngle) * radius;
        var cy = (centerY) - Math.sin(speedRad+startAngle) * radius;

        if(data["electrics"]["watertemp"] < 70 ){ //only min
          gagues.temp.low.attr({d: "M " + sx + "," + sy +
            " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",1 " + cx + "," + cy
          });
          gagues.temp.normal.attr({d: "M " + cx + "," + cy + " " +cx+","+cy});
          gagues.temp.high.attr({d: "M " + cx + "," + cy + " " +cx+","+cy});
        }else{
          gagues.temp.low.attr({d: "M " + sx + "," + sy +
            " A" + radius  + "," + radius  + " 0 0,1 " + mx + "," + my
          });

          if(data["electrics"]["watertemp"] < 110 ){ //no RED
            gagues.temp.normal.attr({d: "M " + mx + "," + my +
              " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",1 " + cx + "," + cy
            });
            gagues.temp.high.attr({d: "M " + cx + "," + cy + " " +cx+","+cy});
          }else{
            gagues.temp.normal.attr({d: "M " + mx + "," + my +
              " A" + radius  + "," + radius  + " 0 "+largeArcFlag+",1 " + rx + "," + ry
            });
            gagues.temp.high.attr({d: "M " + rx + "," + ry +
              " A" + radius  + "," + radius  + " 0 0,1 " + cx + "," + cy
            });
          }

        }
        //gagues.fuel.normal.attr({d: "M " + ex1 + "," + ey1 + " " +ex2+","+ey2});
      }
    }

    // overwriting plain javascript function so we can access from within the controller
    $window.setup = (data) => {
      if(!ready){
        console.log("calling setup while svg not fully loaded");
        setTimeout(function(){ $window.setup(data) }, 100);
        return;
      }
      //console.log("setup",data);
      painduchocolat.root.n.style.display = "none";
      if(data.unit == "metric"){
        speedoDisplay.speedUnit.text("km/h");
        unitspeedConv = 3.6;
        redrawSpeedoTicks(data.max_kph,data.speedo_metric_sep_big,data.speedo_metric_sep_small);
      }
      else{
        speedoDisplay.speedUnit.text("mph");
        unitspeedConv = 2.23694;
        redrawSpeedoTicks(data.max_mph,data.speedo_imp_sep_big,data.speedo_imp_sep_small);
      }


      redrawTachoTicks(3,1,1,0);

    }



    $window.initMap = (data) => {
      navDimensions = data.viewParams = [
        data.terrainOffset[0],
        data.terrainOffset[1],
        data.terrainSize[0],
        data.terrainSize[1]
      ];

      $scope.$apply(() => {
        vm.mapData = data;
      });

      navContainer.style.width = data.terrainSize[0] + "px";
      navContainer.style.height = data.terrainSize[1] + "px";
    }

    $window.updateMap = (data) => {
      var focusX = -data.x;
      var focusY = data.y;
      var origin = `${((navDimensions[0] * -1)) - focusX}px ${((navDimensions[1] * -1)) - focusY}px`;
      navContainer.style.transformOrigin = origin;
      var translateX = ((((navDimensions[0])) + 512) + focusX);
      var translateY = ((((navDimensions[1])) + 256) + focusY);
      navContainer.style.transform = `translate3d(${translateX}px,${translateY}px, 0px) rotateX(${55}deg) rotateZ(${180 + (data.rotation + 360)}deg) scale(1)`;
    }

    var hue = 0;

    function setElec(val, state, key){
      if( val === undefined || val === null){console.error("setElec: svg element not found", key); return;}
      if( state === undefined || state === null){console.error("setElec: state not found", key);val.n.style.display = "none"; return;}
      var cssState = (state===true || state>0.1)?"inline":"none";
      val.n.style.display = cssState;
      //val.n.setAttribute("opacity", (state || state>0.1)?1.0:0.3)
    }

    $window.updateElectrics = (data) => {
      if(data.electrics.cruiseControlActive === undefined){data.electrics.cruiseControlActive = false}
      for(var k in electrics.lights){
        setElec(electrics.lights[k], data.electrics[k], k);
      }

      electrics.esc.n.style.display = (data.electrics["esc"]==1) ?"inline":"none";
      if(data.electrics["esc"] === undefined){
        //nope
      }else{
        if( electrics.esc.n.classList.contains("blink") !== (data.electrics["esc"]===1) && data.electrics["escActive"]){
          electrics.esc.n.classList.toggle("blink", data.electrics["esc"]===1);
        }
        if(electrics.esc.n.classList.contains("blink") && !data.electrics["escActive"]){
          electrics.esc.n.classList.remove("blink");
        }
      }
      electrics.tcs.n.style.display = (data.electrics["tcs"]===1) ?"inline":"none";
      if(data.electrics["tcs"] === undefined){
        //nope
      }else{
        if( electrics.tcs.n.classList.contains("blink") !== (data.electrics["tcs"]===1) && data.electrics["tcsActive"]){
          electrics.tcs.n.classList.toggle("blink", data.electrics["tcs"]===1);
        }
        if(electrics.tcs.n.classList.contains("blink") && !data.electrics["tcsActive"]){
          electrics.tcs.n.classList.remove("blink");
        }
      }
      /*electrics.temp_logo.css({
        "stroke":(data.electrics.watertemp > 110)?"#ef3535":"#fff",
        "fill":(data.electrics.watertemp > 110)?"#ef3535":"#fff"});
      electrics.fuel_logo.css({"fill":(data.electrics.lowfuel )?"#ef3535":"#fff"});*/
      electrics.battery_txt.text((data.electrics.fuel*100.0).toFixed(0) + "%")
      .css({"fill":(data.electrics.lowfuel )?"#ef3535":"#fff"});
      electrics.bat_stop1.n.setAttribute("offset", data.electrics.fuel-0.001 );
      electrics.bat_stop2.n.setAttribute("offset", data.electrics.fuel+0.001 );

      setElec(electrics.lights_fog_front, data.electrics["fog"], "fog");

      electrics.temp_env_txt.text((data.temp ).toFixed(0) + "°C");

    }

    //https://stackoverflow.com/a/56266358
    function isColor(strColor){
      var s = new Option().style;
      s.color = strColor;
      return s.color !== "";
    }

    $window.updateMode = (data) => {
      if(!ready){
        console.log("calling updateMode while svg not fully loaded");
        setTimeout(function(){ $window.updateMode(data) }, 100);
        return;
      }
      //error checking because we can't trust people we work with
      if(data === null
      || data === undefined
      || data.txt === null
      || data.txt === undefined
      || typeof data.txt !== "string"
      || data.col === null
      || data.col === undefined
      || typeof data.col !== "string"){
        console.error("updateMode receive wrong arguments :", data);
        document.getElementById("layer_wip").style.display = "inline";
        document.getElementById("tspan995").innerHTML = "MODE";
        return;
      }
      if(!isColor(data.col)){
        console.error("This mode color is not in html format :",data.col)
        document.getElementById("layer_wip").style.display = "inline";
        document.getElementById("tspan995").innerHTML = "COL";
        return;
      }

      //if you fixed without reload
      if(document.getElementById("tspan995").innerHTML === "COL"
      ||document.getElementById("tspan995").innerHTML === "MODE"){
        document.getElementById("layer_wip").style.display = "none";
      }

      //hex color without # works in html but not in svg BECAUSE
      var s = new Option().style;
      s.color = data.col;
      data.col = s.color;

      electrics.mode_txt.text(data.txt).css({"fill": data.col});

      electrics.esc.css({"fill": data.col});
      electrics.tcs.css({"fill": data.col});
      hu('#rect5554', svg).css({"stroke": data.col});//bat
      hu('#rect5560', svg).css({"fill": data.col});
      electrics.bat_stop1.css({"stop-color": data.col});
      electrics.bat_stop2.css({"stop-color": data.col});
      electrics.bat_stop3.css({"stop-color": data.col});

      hu('#stop5524', svg).css({"stop-color": data.col});
      hu('#stop986', svg).css({"stop-color": data.col});
      hu('#stop988', svg).css({"stop-color": data.col});


      hu('#stop5483', svg).css({"stop-color": data.col});
      hu('#stop5496', svg).css({"stop-color": data.col});
      hu('#stop5498', svg).css({"stop-color": data.col});
      hu('#stop5485', svg).css({"stop-color": data.col});

      //force redraw of gradient cause color doesn't change sometimes, thx CEF
      hu('#radialGradient5520', svg).n.gradientTransform.baseVal[0].matrix.f = 0;
    }

    $window.updateData = (data) => {
      if (data) {
        if(!ready){console.log("not ready");return;}
        // console.log(data);
        //hue = (hue+.5) % 360;
        //setTheme(hue);

        // Update PRNDS display
        updateGearIndicator(data);
        // Update Speed displays
        updateSpeedDisplays(data);
        updateTachoDisplays(data);

        updateElectrics(data);

        // if (data.gForcesVisible === true) {
        //   updateAccelerometer(data);
        //   consumGraph.root.css({opacity: 0});
        //   infoDisplay.infoValues.css({opacity: 0});
        //   consumGraph.graph_canvas.style.display = "none";
        // }
        // else {
        //   infoDisplay.accelerometer.css({opacity: 0});
        //   consumGraph.root.css({opacity: 1});
        //   consumGraph.graph_canvas.style.display = "inline";
        //   infoDisplay.infoValues.css({opacity: 1});
        // }
      }
    }
    ready = true;
    //$window.updateConsum({current:0, average:0, range:0});
  });