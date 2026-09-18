import type { GameKey } from '../port.ts';
/** Source ownership prevents one finger/key release from releasing another held source. */
export class InputOwners {
  private owners=new Map<string,GameKey>();
  has(key:GameKey):boolean{return [...this.owners.values()].includes(key);}
  press(owner:string,key:GameKey):boolean{if(this.owners.has(owner))return false;const first=!this.has(key);this.owners.set(owner,key);return first;}
  release(owner:string):GameKey|null{const key=this.owners.get(owner);if(!key)return null;this.owners.delete(owner);return this.has(key)?null:key;}
  clear():GameKey[]{const keys=[...new Set(this.owners.values())];this.owners.clear();return keys;}
}
