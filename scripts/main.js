// ============================
// Variables
// ============================

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

var frozenCamX = undefined;
var frozenCamY = undefined;

// Tables
var mainTable = new Table();
var table = new Table();

// States
var worldLoaded = false;
var dragging = false;
var isMobile = false;
var mobileBtnActiv = false;
var startX = 0, startY = 0, endX = 0, endY = 0;
// var prevEndX = -1, prevEndY = -1; // For memory optimization
var regions = []; // Array for storing all regions

print("MOD: check: " + Core.input.mouseX());

// ============================
// Platform Specific Handler
// ============================

// TODO uncomment this
// Check if user is on mobile
// if (Core.app.isDesktop() || Core.app.isWeb()) {
//     isMobile = false;
// }

if (isMobile) {
    var modUpdateRef = mod_mobile_update;
} else {
    var modUpdateRef = mod_update;

    // Button mapping
    var keySelect = KeyCode.c;
    var keyPressed = KeyCode.controlLeft;
}

// ============================
// Events
// ============================

// Create the table after the world is loaded
Events.on(WorldLoadEvent, mod_init);
// Draw the selector per draw trigger tick - draws whatever is available contantly
Events.run(Trigger.draw, mod_drawer);
// Update the regions per update trigger tick - records constantly 
Events.run(Trigger.update, modUpdateRef);

// print("MOD: object check: " + typeof mindustry.input);

// ============================
// Trigger Funcions
// ============================

function mod_updateStatistics() {
    // Summary statistics across all regions
    // FIX-ME statistics across all regions are not summed up
    var totalDrillStats = {speed: 0, effTotal: 0, amount: 0};
    var totalInOutPutStats = {input: new ObjectMap(), output: new ObjectMap(), exceptions: new ObjectMap(), effTotal: 0, amount: 0};
    var totalPowerStats = {production: 0, effTotal: 0, amount: 0}
    
    // Collect data from all regions
    for (let region of regions) {
        var drillStats = dataHandlers.mod_getDrillStatsForReg(region, drillTypes);
        var inOutPutStats = dataHandlers.mod_getInOutPutStatsForReg(region, exceptionResults, exceptionMulti, waterExtractor, oilExtractor, oil);
        var powerStats = dataHandlers.mod_getPowerStatsForReg(region);

        if ((drillStats !== undefined) || (inOutPutStats !== undefined) || (powerStats !== undefined)) mainTable.clearChildren();

        //  Drills
        if (!(drillStats === undefined)) {
            // Sum drills
            totalDrillStats.speed += drillStats.speed;
            totalDrillStats.effTotal += drillStats.effTotal;
            totalDrillStats.amount += drillStats.amount;

            // Drill statistics
            if (totalDrillStats.amount > 0) {
                var drillTable = new Table();
                drillTable.left().margin(5, 0, 5, 0);
                drillTable.add("[accent]" + Core.bundle.get("rateCalculate.drills") + ":[]").left().fontScale(0.8).row();

                let speedNumb = Math.round(totalDrillStats.speed * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
                drillTable.add(Core.bundle.get("rateCalculate.speed") + ": " + speedNumb).left().fontScale(0.8).row();

                let efficiNumb = Math.round(totalDrillStats.effTotal / totalDrillStats.amount * 1000) / 10 + "%";
                drillTable.add(Core.bundle.get("rateCalculate.efficiency") + ": " + efficiNumb).left().fontScale(0.8).row();

                mainTable.add(drillTable).left().row();
            }
        }
        
        // IO
        if (!(inOutPutStats === undefined)) {
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

            // Factory statistics (input)
            let totalFactoriesInput = totalInOutPutStats.input;
            if (totalFactoriesInput.size > 0) {
                var outTable = new Table();
                outTable.left().margin(5, 0, 5, 0);
                outTable.add("[accent]" + Core.bundle.get("rateCalculate.input") + ":[]").left().fontScale(0.8).marginBottom(5).row();
                
                totalFactoriesInput.each((item, amount) => {
                    var rowTable = new Table();
                    rowTable.left();

                    rowTable.add(new Image(item.uiIcon)).left().size(24);

                    let inputNumb = Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
                    rowTable.add(item + ": " + inputNumb).left().fontScale(0.8);

                    outTable.add(rowTable).left().row();
                });

                mainTable.add(outTable).left().row();
            }
            
            // Factory statistics (output)
            let totalFactoriesOutput = totalInOutPutStats.output;
            if (totalFactoriesOutput.size > 0 || totalInOutPutStats.exceptions.size > 0) {
                var outTable = new Table();
                outTable.left().margin(5, 0, 5, 0);
                outTable.add("[accent]" + Core.bundle.get("rateCalculate.output") + ":[]").left().fontScale(0.8).marginBottom(5).row();

                totalFactoriesOutput.each((item, amount) => {
                    var rowTable = new Table();
                    rowTable.left();

                    let result = 0;
                    let amountString = "";
                    if (totalInOutPutStats.exceptions.containsKey(item)) {
                        amountString = "~";
                        result += totalInOutPutStats.exceptions.get(item);
                        totalInOutPutStats.exceptions.remove(item);
                    }
                    
                    rowTable.add(new Image(item.uiIcon)).left().fontScale(0.8).size(24);

                    amountString += Math.round((amount + result) * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
                    rowTable.add(item + ": " + amountString).left().fontScale(0.8);

                    outTable.add(rowTable).left().row();
                });

                totalInOutPutStats.exceptions.each((item, amount) => {
                    var rowTable = new Table();
                    rowTable.left();

                    rowTable.add(new Image(item.uiIcon)).left().fontScale(0.8).size(24);
                    
                    let amount = "~" + Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
                    rowTable.add(item + ": " + amount).left().fontScale(0.8);

                    outTable.add(rowTable).left().row();
                });

                mainTable.add(outTable).left().row();
            }

            // Overall factory efficiency
            if (totalFactoriesInput.size > 0 || totalFactoriesOutput.size > 0) {
                var efficiTable = new Table();
                efficiTable.left().margin(5, 0, 5, 0);

                efficiTable.add("[accent]" + Core.bundle.get("rateCalculate.overall") + ": []").left().fontScale(0.8).row();

                let efficiNumb = Math.round(totalInOutPutStats.effTotal / totalInOutPutStats.amount * 1000) / 10 + "%";
                efficiTable.add(Core.bundle.get("rateCalculate.efficiency") + ": " + efficiNumb).left().fontScale(0.8).row();

                mainTable.add(efficiTable).left().row();
            }
        }

        // Power
        if (!(powerStats === undefined)) {
            // Sum power
            totalPowerStats.production = powerStats.production;
            totalPowerStats.effTotal = powerStats.effTotal;
            totalPowerStats.amount = powerStats.amount;
            
            // Power statistics
            if (totalPowerStats.amount > 0) {
                var powerTable = new Table();
                powerTable.left().margin(5, 0, 5, 0);

                powerTable.add("[accent]" + Core.bundle.get("rateCalculate.energy") + ":[]").left().fontScale(0.8).row();

                let powerNumb = Math.round(totalPowerStats.production * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
                powerTable.add(Core.bundle.get("rateCalculate.production") + ": " + powerNumb).left().fontScale(0.8).row();

                let efficiNumb = Math.round(totalPowerStats.effTotal / totalPowerStats.amount * 1000) / 10 + "%";
                powerTable.add(Core.bundle.get("rateCalculate.efficiency") + ": " + efficiNumb).left().fontScale(0.8);

                mainTable.add(powerTable).left().row();
            }
        }
    }
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

// --------------
// Update Functions
// --------------

function mod_update() {
    if (!worldLoaded) return;

    const ctrlPressed = Core.input.keyDown(keyPressed);

    if (ctrlPressed && Core.input.isTouched()) mainTable.clearChildren();
    
    // If holding mb get coords - you're dragging now
    if (Core.input.keyTap(keySelect)) {
        startX = World.toTile(Core.input.mouseWorldX());
        startY = World.toTile(Core.input.mouseWorldY());
        // endX = -1;
        // endY = -1;
        dragging = true;
    }
    
    // If dragging grab end coords
    if (dragging) {
        // prevEndX = endX;
        // prevEndY = endY;
        endX = World.toTile(Core.input.mouseWorldX());
        endY = World.toTile(Core.input.mouseWorldY());
        
        regions[0] = {
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        }

        if (!Core.input.keyDown(keySelect)) {
            dragging = false;
        }

        mod_updateStatistics();

        regions = [];
    }
}

// Mobile version of mod update
function mod_mobile_update() {
    if (!worldLoaded) return;

    if (mobileBtnActiv && !dragging && Core.input.isTouched()) {
        startX = World.toTile(Core.input.mouseWorldX());
        startY = World.toTile(Core.input.mouseWorldY());

        dragging = true;
    }

    if (dragging) {
        if (frozenCamX === undefined) {
            frozenCamX = Core.camera.position.getX();
            frozenCamY = Core.camera.position.getY();
        }

        Core.camera.position.set(frozenCamX, frozenCamY);

        // Stops panning for the user so that they can select things
        endX = World.toTile(Core.input.mouseWorldX());
        endY = World.toTile(Core.input.mouseWorldY());

        regions[0] = {
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        }

        if (!Core.input.isTouched()) {
            dragging = false;
            frozenCamX = undefined;
            frozenCamY = undefined;
        }
        
        mobileBtnActiv = false;
    }

    mod_updateStatistics();

    regions = [];
}

// ============================
// Event Functions
// ============================

function mod_init() {
    table.clearChildren();

    // Checks if user is on mobile
    Vars.ui.hudGroup.removeChild(table);
    Vars.ui.hudGroup.addChild(table);
    
    table.bottom().left();

    // Between table
    var betweenTable = new Table();
    table.add(betweenTable);

    // Main table
    mainTable.background(Tex.pane);
    mainTable.left().margin(13); // (top, left, bottom, right) OR (all)
    betweenTable.add(mainTable).growX().row();

    // Btn table
    // If user is on mobile make the button
    if (isMobile) {
        var btnTable = new Table(Tex.pane);
        btnTable.left().margin(0, 15, 0, 15);

        let modName = "rate-calculate";
        
        let calcIconName = "calculator_32";
        let resetIconName = "crafting_32";
        
        let calcIcon = TextureRegionDrawable(Core.atlas.find(modName + "-" + calcIconName));
        let resetIcon = TextureRegionDrawable(Core.atlas.find(modName + "-" + resetIconName));

        // The mobile button
        btnTable.button(calcIcon, () => {
            mobileBtnActiv = true;
        });
        
        btnTable.add(new Table()).marginRight(10);
        
        btnTable.button(resetIcon, () => {
            mainTable.clearChildren();
        });
        
        // Adding it to the main table
        betweenTable.add(btnTable).left().growX();
    } else {
        // idk
        var hintTable = new Table(Tex.pane);
        hintTable.left();
        hintTable.add("[lightgray]" + Core.bundle.get("rateCalculate.select") + "[lightgray]([accent]C[lightgray])").left().fontScale(0.8).row();
        hintTable.add("[lightgray]" + Core.bundle.get("rateCalculate.reset") + "[lightgray]([accent]Ctrl+RMB[lightgray])").left().fontScale(0.8);

        betweenTable.add(hintTable).left().growX();
    }

    worldLoaded = true;
}