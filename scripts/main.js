// Constants
const dataHandlers = require("block_data_handlers");

const exceptionResults = [Blocks.separator, Blocks.disassembler];
const exceptionMulti = [Blocks.siliconCrucible, Blocks.cultivator];
const waterExtractor = Blocks.waterExtractor;
const oilExtractor = Blocks.oilExtractor;
const oil = Liquids.oil;

const drillTypes = [
    Blocks.mechanicalDrill,
    Blocks.pneumaticDrill,
    Blocks.laserDrill,
    Blocks.blastDrill,
    Blocks.eruptionDrill,
    Blocks.impactDrill,
];

// Keys
var keyDrillSpeed = KeyCode.c;
var keyPressed = KeyCode.controlLeft;

// Main table
var table = new Table();
var mainTable = new Table();

// States
var worldLoaded = false;
var dragging = false;
var startX = 0, startY = 0, endX = 0, endY = 0;
// var prevEndX = -1, prevEndY = -1; // For memory optimization
var regions = []; // Array for storing all regions

// Main events
Events.on(WorldLoadEvent, init);
Events.run(Trigger.draw, mod_drawer);
Events.run(Trigger.update, mod_update);

function mod_updateStatistics() {
    mainTable.clearChildren();
    
    if (regions.length === 0) {
        mainTable.add("[lightgray]" + Core.bundle.get("rateCalculate.select") + "[]").left().row();
        mainTable.add("[lightgray]" + Core.bundle.get("rateCalculate.selectfew") + "[]").left();
        return;
    }
    
    // Summary statistics across all regions
    var totalDrillStats = {speed: 0, effTotal: 0, amount: 0};
    var totalInOutPutStats = {input: new ObjectMap(), output: new ObjectMap(), exceptions: new ObjectMap(), effTotal: 0, amount: 0};
    var totalPowerStats = {production: 0, effTotal: 0, amount: 0}
    
    // Collect data from all regions
    for (let region of regions) {
        var drillStats = dataHandlers.mod_getDrillStatsForReg(region, drillTypes);
        var inOutPutStats = dataHandlers.mod_getInOutPutStatsForReg(region, exceptionResults, exceptionMulti, waterExtractor, oilExtractor, oil);
        var powerStats = dataHandlers.mod_getPowerStatsForReg(region);

        // Sum drills
        totalDrillStats.speed += drillStats.speed;
        totalDrillStats.effTotal += drillStats.effTotal;
        totalDrillStats.amount += drillStats.amount;
        
        // Sum input and output
        inOutPutStats.input.each((item, amount) => {
            totalInOutPutStats.input.put(item, totalInOutPutStats.input.get(item, 0) + amount);
        });
        inOutPutStats.output.each((item, amount) => {
            totalInOutPutStats.output.put(item, totalInOutPutStats.output.get(item, 0) + amount);
        });
        inOutPutStats.exceptions.each((item, amount) => {
            totalInOutPutStats.exceptions.put(item, totalInOutPutStats.exceptions.get(item, 0) + amount);
        });
        totalInOutPutStats.effTotal += inOutPutStats.effTotal;
        totalInOutPutStats.amount += inOutPutStats.amount;
        
        // Sum power
        totalPowerStats.production = powerStats.production;
        totalPowerStats.effTotal = powerStats.effTotal;
        totalPowerStats.amount = powerStats.amount;
    };
    
    // Drill statistics
    if (totalDrillStats.amount > 0) {
        var drillTable = new Table();
        drillTable.add("[accent]" + Core.bundle.get("rateCalculate.drills") + ":[]").row();
        drillTable.add(Core.bundle.get("rateCalculate.speed") + " : ").left();
        drillTable.add(Math.round(totalDrillStats.speed * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left().row();
        drillTable.add(Core.bundle.get("rateCalculate.efficiency") + ": ").left();
        drillTable.add(Math.round(totalDrillStats.effTotal / totalDrillStats.amount * 1000) / 10 + "%").left().row();
        mainTable.add(drillTable).row();
    }
    
    // Power statistics
    if (totalPowerStats.amount > 0) {
        mainTable.row();
        var powerTable = new Table();
        powerTable.add("[accent]" + Core.bundle.get("rateCalculate.energy") + ":[]").row();
        powerTable.add(Core.bundle.get("rateCalculate.production") + ": ").left();
        powerTable.add(Math.round(totalPowerStats.production * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left().row();
        powerTable.add(Core.bundle.get("rateCalculate.efficiency") + ": ").left();
        powerTable.add(Math.round(totalPowerStats.effTotal / totalPowerStats.amount * 1000) / 10 + "%").left().row();
        mainTable.add(powerTable).row();
    }
    
    // Factory statistics (input)
    let totalFactoriesInput = totalInOutPutStats.input;
    if (totalFactoriesInput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.input") + ":[]").row();
        
        totalFactoriesInput.each((item, amount) => {
            var rowTable = new Table();
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            rowTable.add(Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left();
            mainTable.add(rowTable).left().row();
        });
    }
    
    // Factory statistics (output)
    let totalFactoriesOutput = totalInOutPutStats.output;
    if (totalFactoriesOutput.size > 0 || totalInOutPutStats.exceptions.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.output") + ":[]").row();

        totalFactoriesOutput.each((item, amount) => {
            var rowTable = new Table();
            let result = 0;
            let amountString = "";
            if (totalInOutPutStats.exceptions.containsKey(item)) {
                amountString = "~";
                result += totalInOutPutStats.exceptions.get(item);
                totalInOutPutStats.exceptions.remove(item);
            }
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            amountString += Math.round((amount + result) * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
            rowTable.add(amountString).left();
            mainTable.add(rowTable).left().row();
        });

        totalInOutPutStats.exceptions.each((item, amount) => {
            var rowTable = new Table();
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            rowTable.add("~" + Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left();
            mainTable.add(rowTable).left().row();
        });
    }

    // Overall factory efficiency
    if (totalFactoriesInput.size > 0 || totalFactoriesOutput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.overall") + ": []");
        mainTable.add(Math.round(totalInOutPutStats.effTotal / totalInOutPutStats.amount * 1000) / 10 + "%").left().row();
    }
}

//
// Main functions: Initialization, Frame drawing, Update – InputHandler
//

function init() {
    table.clearChildren();
    
    Vars.ui.hudGroup.removeChild(table);
    Vars.ui.hudGroup.addChild(table);
    
    table.bottom().left().margin(Scl.scl(5));

    let betweenTable = new Table();
    betweenTable.margin(Scl.scl(5));
    betweenTable.background(Styles.black5);
    
    table.add(betweenTable);

    betweenTable.add(mainTable);

    worldLoaded = true; 
}

function mod_drawer() {
    if (!worldLoaded) return;

    // Draw the current region (if any)
    if (dragging) {
        let wx1 = Math.min(startX, endX) * Vars.tilesize;
        let wy1 = Math.min(startY, endY) * Vars.tilesize;
        let wx2 = (Math.max(startX, endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(startY, endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    }

    // Draw all saved regions
    for (let region of regions) {
        let wx1 = Math.min(region.startX, region.endX) * Vars.tilesize;
        let wy1 = Math.min(region.startY, region.endY) * Vars.tilesize;
        let wx2 = (Math.max(region.startX, region.endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(region.startY, region.endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    };
}

function mod_update() {
    if (!worldLoaded) return;

    const ctrlPressed = Core.input.keyDown(keyPressed);
    
    if (Core.input.keyTap(keyDrillSpeed)) {
        startX = World.toTile(Core.input.mouseWorldX());
        startY = World.toTile(Core.input.mouseWorldY());
        // endX = -1;
        // endY = -1;
        dragging = true;
    }
    
    if (dragging) {
        // prevEndX = endX;
        // prevEndY = endY;
        endX = World.toTile(Core.input.mouseWorldX());
        endY = World.toTile(Core.input.mouseWorldY());
        
        if (ctrlPressed) {
            if (!Core.input.keyDown(keyDrillSpeed)) {
                regions.push({
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY
                });
            }
        } else {
            regions[0] = {
                startX: startX,
                startY: startY,
                endX: endX,
                endY: endY
            }
        }

        if (!Core.input.keyDown(keyDrillSpeed)) {
            dragging = false;
        }
    }

    // if (prevEndX !== endX || prevEndY !== endY)
    //     mod_updateStatistics();

    mod_updateStatistics();

    if (!ctrlPressed) {
        regions = [];
    }
}
