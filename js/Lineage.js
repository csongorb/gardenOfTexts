// =================================
// Lineage
// =================================

// one per letter of the original text: remembers where it was first planted and keeps track of all its living descendants
// (the plants themselves live in the garden's flat list, this is only an index on top of it)
class Lineage {

    constructor(_id, _char, _originX, _originY, _baseSize) {
        this.id = _id; // index in the garden's lineages, stored in each plant as plant.lineage
        this.char = _char;
        this.originX = _originX; // where the original letter was planted
        this.originY = _originY;
        this.baseSize = _baseSize;
        this.members = []; // living plants of this lineage
        this.lastSeen = null; // last living plant, so an extinct lineage can sprout again there
    }

    static fromSerialized(data, id) {
        var lineage = new Lineage(id, data.char, data.originX, data.originY, data.baseSize);
        lineage.lastSeen = data.lastSeen ? charPlantFromSerialized(data.lastSeen) : null;
        return lineage;
    }

    serialize() {
        return {
            char: this.char,
            originX: this.originX,
            originY: this.originY,
            baseSize: this.baseSize,
            lastSeen: this.lastSeen ? this.lastSeen.serialize() : null
        };
    }

    add(plant) {
        this.members.push(plant);
        this.lastSeen = plant;
    }

    // drops dead members; lastSeen stays on the last one, so it's still known after extinction
    prune() {
        this.members = this.members.filter(function (plant) {
            return !plant.isDead;
        });
        if (this.members.length > 0) {
            this.lastSeen = this.members[this.members.length - 1];
        }
    }

    get count() {
        return this.members.length;
    }

    isExtinct() {
        return this.members.length === 0;
    }
}
