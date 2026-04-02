import { enrichClickFunction, enrichExistingClickFunction } from "./functions/enrich-click";
import { repairGeoFunction } from "./functions/repair-geo";

export const functions = [enrichClickFunction, enrichExistingClickFunction, repairGeoFunction];
