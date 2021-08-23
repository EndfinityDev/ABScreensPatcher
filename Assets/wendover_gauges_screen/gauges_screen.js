angular.module('gaugesScreen', [])

  .controller('GaugesScreenController', function ($scope, $element, $window) {
    "use strict";
    var vm = this;

    var svg;
    var navContainer = $element[0].children[0];
    var navDimensions = [];

    var gauge = { gears: {} };
    var tacho = {  };
    var infoDisplay = {};
    var roots = {};
    var electrics = {lights:{} };
    var gagues = {fuel:{},temp:{}};


    var speedoInitialised = true;
    var currentGear = '';

    var ready = false;

    var unit = "metric";
    var unitspeedConv = 2.23694;


    // Make sure SVG is loaded
    $scope.onSVGLoaded = function () {
        console.log("onSVGLoaded");
      svg = $element[0].children[0].children[0];


      gauge.speedValue = hu('#speedo_txt', svg);
      gauge.tachoValue = hu('#tacho_txt', svg);

      infoDisplay.hour = hu('#clock_hour_txt', svg);
      infoDisplay.min = hu('#clock_min_txt', svg);

      roots.speedo_bar = hu('#speedo_bar', svg);
      roots.tacho_bar = hu('#tacho_bar', svg);
      roots.fuel_bar = hu('#fuel_bar', svg);
      roots.temp_bar = hu('#temp_bar', svg);
      roots.oil_bar = hu('#oil_bar', svg);
      roots.battery_bar = hu('#battery_bar', svg);

      infoDisplay.mpg = hu('#mpg_txt', svg);


      // speedometer
      gauge.gears.P = hu('#gear_P', svg);
      gauge.gears.R = hu('#gear_R', svg);
      gauge.gears.N = hu('#gear_N', svg);
      gauge.gears.D = hu('#gear_D', svg);
      gauge.gears["1"] = hu('#gear_1', svg);
      gauge.gears["2"] = hu('#gear_2', svg);


      electrics.root = hu('#electrics', svg);
      electrics.lights.signal_L = hu("#light_signal_L", electrics.root);
      electrics.lights.signal_R = hu("#light_signal_R", electrics.root);
      electrics.lights.lights = hu("#light_lights", electrics.root);
      electrics.lights.highbeam = hu("#light_highbeam", electrics.root);
      electrics.lights.parkingbrake = hu("#light_parkingbrake", electrics.root);
      electrics.lights.checkengine = hu("#light_checkengine", electrics.root);
      electrics.lights.oil = hu("#light_oil", electrics.root);
      electrics.lights.lowfuel = hu("#light_lowfuel", electrics.root);

      electrics.lights_battery = hu("#light_battery", electrics.root);
      electrics.abs = hu("#light_abs", electrics.root);
      electrics.temp_logo = hu("#light_highwatertemp", electrics.root);

      ready = true;
    }


    function fixClock(v, fill="0"){
      return (v<10)? fill+v : v;
    }

    function updateGearIndicator(data) {
      // only update when gear is changed
      if (currentGear !== data.electrics.gear) {
        currentGear = data.electrics.gear;
        if(data.gearboxType === "automaticGearbox"){//auto
          for (var key in gauge.gears) {
            gauge.gears[key].n.style.display = (key === data.electrics.gear)?"inline":"none";
          }
        }else{//other (manual,seq)
          for (var key in gauge.gears) {
            gauge.gears[key].n.style.display = "none";
          }
          gauge.gears = {}; //remove ref, so we don't iterate over it again
        }
      }
    }

    function updateSpeedDisplays(data) {
      let speed = data.electrics.wheelspeed * unitspeedConv
      gauge.speedValue.text((speed ).toFixed(0));

      let children = roots.speedo_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {//lucky that the order of elements are ok
        children[i].style.display = (speed > i*2.72)?"inline":"none";
      }

    }

    function updateTachoDisplays(data) {
      let rpm = Math.round(data["electrics"]["rpmTacho"]/10 )*10
      gauge.tachoValue.text(rpm);
      let children = roots.tacho_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {
        let index = parseInt(children[i].id.replace("tacho_bar_",""));
        children[i].style.display = (rpm > index*147.72)?"inline":"none";
      }
    }

    function limitVal(min, val,max){
        return Math.min(Math.max(min,val), max);
    }

    function updateGagueFuel(data) {
      let fuel = data.electrics.fuel;
      let children = roots.fuel_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {
        let index = parseInt(children[i].id.replace("fuel_bar_","")); //not lucky :(
        children[i].style.display = (fuel >= index*0.052 )?"inline":"none";
      }
      if(data.electrics.wheelspeed > 1.4){
        let txt = fixClock((235.215/data.averageFuelConsumption).toFixed(1));
        if(txt.length <= 4)
          infoDisplay.mpg.text(txt);
        else
          infoDisplay.mpg.text("Err");

      }
      else{
        infoDisplay.mpg.text("---")
      }
    }

    function updateGagueTemp(data) {
      let temp = data.electrics.watertemp -40;
      //min 40C, max 120 C, useing metric cause lazy
      let children = roots.temp_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {
        let index = parseInt(children[i].id.replace("temp_bar_","")); //not lucky :(
        children[i].style.display = (temp >= index*8.88)?"inline":"none";
      }
    }

    function updateOilTemp(data) {
      let val = data.electrics.oiltemp -50;
      //min 50C, max 140 C, useing metric cause lazy
      let children = roots.oil_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {
        let index = parseInt(children[i].id.replace("oil_bar_","")); //not lucky :(
        children[i].style.display = (val >= index*10)?"inline":"none";
      }
    }

    function updateBattery(data) {
      let val = (data.electrics.engineRunning>0.5)? 14.5: 12.5;//fake voltage
      //min 8, max 16 V
      val-=8;
      let children = roots.battery_bar.n.childNodes
      for (let i = 0; i < children.length; i++) {
        let index = parseInt(children[i].id.replace("battery_bar_","")); //not lucky :(
        children[i].style.display = (val >= index*0.888)?"inline":"none";
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

    }


    function setElec(val, state, key){
      if( val === undefined || val === null){console.error("setElec: svg element not found", key); return;}
      if( state === undefined || state === null){console.error("setElec: state not found", key);val.n.style.display = "none"; return;}
      var cssState = (state===true || state>0.1)?"inline":"none";
      val.n.style.display = cssState;
      //val.n.setAttribute("opacity", (state || state>0.1)?1.0:0.3)
    }

    $window.updateElectrics = (data) => {

      for(var k in electrics.lights){
        setElec(electrics.lights[k], data.electrics[k], k);
      }

      electrics.abs.n.style.display = (data.electrics["abs"]==1) ?"inline":"none";
      if(data.electrics["abs"] === undefined){
        //nope
      }else{
        if( electrics.abs.n.classList.contains("blink") !== (data.electrics["abs"]===1)){
          electrics.abs.n.classList.toggle("blink", data.electrics["abs"]===1);
        }
      }

      electrics.temp_logo.n.style.display = (data.electrics.watertemp > 110)?"inline":"none";

      electrics.lights_battery.n.style.display = (data.electrics.engineRunning<0.1)?"inline":"none";

      const current_time = new Date(Date.now());
      infoDisplay.hour.text(fixClock(current_time.getHours(), "{"));
      infoDisplay.min.text(fixClock(current_time.getMinutes()));

    }


    $window.updateData = (data) => {
      if (data) {
        if(!ready){console.log("not ready");return;}
        // console.log(data);

        // Update PRNDS display
        updateGearIndicator(data);
        // Update Speed displays
        updateSpeedDisplays(data);
        updateTachoDisplays(data);

        updateElectrics(data);
        updateGagueFuel(data);
        updateGagueTemp(data);
        updateOilTemp(data);
        updateBattery(data);
      }
    }
    //ready = true;
  });