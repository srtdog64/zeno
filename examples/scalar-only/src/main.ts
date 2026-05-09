import { InstanceView } from "./model.view.js";

const recordCount = 1_000_000;
const buffer = new ArrayBuffer(InstanceView.byteLength * recordCount);
const view = new DataView(buffer);

for (let index = 0; index < recordCount; index += 1) {
  InstanceView.setEntityIdAt(view, index + 1, index);
  InstanceView.setKindAt(view, index % 8, index);
  InstanceView.setXAt(view, index * 0.01, index);
  InstanceView.setYAt(view, index * 0.02, index);
  InstanceView.setZAt(view, index * 0.03, index);
  InstanceView.setHealthAt(view, 100 - (index % 100), index);
  InstanceView.setFlagsAt(view, index % 2 === 0 ? 0b001 : 0, index);
  InstanceView.setActiveAt(view, index % 2 === 0, index);
}

const activeCount = InstanceView.countActiveWhereEq(view, recordCount, true);
const firstKindSeven = InstanceView.findFirstKindWhereEq(view, recordCount, 7);
const totalHealth = InstanceView.sumHealth(view, recordCount);
const minHealth = InstanceView.minHealth(view, recordCount);
const maxHealth = InstanceView.maxHealth(view, recordCount);

console.log({
  activeCount,
  firstKindSeven,
  totalHealth,
  averageHealth: totalHealth / recordCount,
  minHealth,
  maxHealth,
});
