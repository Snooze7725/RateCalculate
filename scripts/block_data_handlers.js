// BUG Either make new prefixes that don't rely on classes, or make a class that's 
// explicitly custom to avoid collisions
global.modFns = global.modFns || {};

modFns.getDrillStatsForReg = function(region, drillTypes) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let speed = 0;
    let amount = 0;
    let effTotal = 0;
    let IDs = [];
    
    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if(build == null || build.block == null) continue;
            
            if(drillTypes.includes(build.block)){
                if (IDs.includes(build.id)) continue;
                IDs.push(build.id);
                
                speed += modFns.getDrillRate(build, build.block);
                amount++;
                effTotal += build.efficiency;
            }
        }
    }
    return {speed: speed, effTotal: effTotal, amount: amount};
}

modFns.getDrillRate = function(build, block) {
    let drillingItem = build.dominantItem;
    let drillingItems = build.dominantItems;
    let baseDrillTime = block.getDrillTime(drillingItem);

    let liquidBoost = 1;
    // let groundMultiplier = 1;

    // Liquid boost
    if(block.hasLiquids && build.liquids.currentAmount() >= 0.001) {
        liquidBoost *= block.liquidBoostIntensity * block.liquidBoostIntensity;
    }

    // // Ground type bonus (for newer drills)
    // if (drill.block.attributes && drill.block.attributes.containsKey(Attribute.heat)) {
    //     groundMultiplier = tile.getAttributes().get(Attribute.heat) * drill.block.attributes.get(Attribute.heat) + 1;
    // }

    return (60 / baseDrillTime * liquidBoost * build.timeScale() * drillingItems);
}

modFns.getInOutPutStatsForReg = function(region, exceptionResults, exceptionMulti, waterExtractor, oilExtractor, oil) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let input = new ObjectMap();
    let output = new ObjectMap();
    let exceptions = new ObjectMap();
    let IDs = [];

    let amount = 0;
    let effTotal = 0;

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if (!build || !build.block) continue;
            let block = build.block;

            if (block == waterExtractor) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = 1 + build.boost;

                let liquidDrop = build.liquidDrop;
                output.put(liquidDrop, block.pumpAmount * 60 * build.timeScale() * exceptionMultiplier + output.get(liquidDrop, 0));
            }
            if (block == oilExtractor) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = build.boost;

                if (block.consumers && block.consumers.length > 0) {
                    for (let consumer of block.consumers) {
                        if (consumer instanceof ConsumeItems) {
                            for (let item of consumer.items) {
                                input.put(item.item, block.itemUseTime / 60 * build.timeScale() * exceptionMultiplier + input.get(item.item, 0));
                            }
                        }
                        if (consumer instanceof ConsumeLiquid) {
                            input.put(consumer.liquid, consumer.amount * 60 * build.timeScale() * exceptionMultiplier + input.get(consumer.liquid, 0));
                        }
                    }
                }

                let liquidDrop = oil;
                output.put(liquidDrop, block.pumpAmount * 60 * build.timeScale() * exceptionMultiplier + output.get(liquidDrop, 0));
            } else if (block.pumpAmount) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let liquidDrop = build.liquidDrop;
                let amountLiquids = 0;

                if (liquidDrop == null) continue;
                let tempTiles = new Seq();
                Vars.world.tile(build.tileX(), build.tileY()).getLinkedTiles(tempTiles).each(other => {
                    if (other.floor().liquidDrop == liquidDrop && other.floor().liquidMultiplier != null)
                        amountLiquids += other.floor().liquidMultiplier;
                });

                output.put(liquidDrop, amountLiquids * block.pumpAmount * 60 * build.timeScale() + output.get(liquidDrop, 0));
            }

            if (block.craftTime) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = 1;
                if (exceptionMulti.includes(block))
                    exceptionMultiplier = build.efficiencyMultiplier();

                if (block.consumers && block.consumers.length > 0) {
                    for (let consumer of block.consumers) {
                        if (consumer instanceof ConsumeItems) {
                            for (let item of consumer.items) {
                                input.put(item.item, item.amount / block.craftTime * 60 * build.timeScale() * exceptionMultiplier + input.get(item.item, 0));
                            }
                        }
                        if (consumer instanceof ConsumeLiquid) {
                            input.put(consumer.liquid, consumer.amount * 60 * build.timeScale() * exceptionMultiplier + input.get(consumer.liquid, 0));
                        }
                    }
                }

                if (block.outputItem) {
                    output.put(block.outputItem.item, block.outputItem.amount / block.craftTime * 60 * build.timeScale() * exceptionMultiplier + output.get(block.outputItem.item, 0));
                }
                if (block.outputLiquid) {
                    output.put(block.outputLiquid.liquid, block.outputLiquid.amount * 60 * build.timeScale() * exceptionMultiplier + output.get(block.outputLiquid.liquid, 0));
                }

                if (exceptionResults.includes(block) && block.results != null) {
                    let totalAmount = 0;
                    for (let item of block.results) {
                        totalAmount += item.amount;
                    }

                    for (let item of block.results) {
                        exceptions.put(item.item, (item.amount / totalAmount) / block.craftTime * 60 * build.timeScale() + exceptions.get(item.item, 0));
                    }
                }
            }
        }
    }

    return {input: input, output: output, exceptions: exceptions, effTotal: effTotal, amount: amount};
}

modFns.getPowerStatsForReg = function(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let totalPower = 0;
    let amount = 0;
    let effTotal = 0;
    let IDs = []

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if (!build || !build.block) continue;
            let block = build.block;

            if (!block.powerProduction) continue;

            if (IDs.includes(build.id)) continue;

            IDs.push(build.id);
            totalPower += getPowerProdRate(build, block);
            amount++;
            effTotal += build.efficiency;
        }
    }

    return {production: totalPower, effTotal: effTotal, amount: amount};
}

modFns.getPowerProdRate = function(build, block) {
    let production = build.getPowerProduction() || block.powerProduction;
    
    let usagePower = block.consPower;
    if (usagePower != null) usagePower = usagePower.usage;
    else usagePower = 0;
    
    production = (production - usagePower) * 60 * build.timeScale();
    
    return production;
}
