export default class AsyncMap<K, V> {
    map: Map<K, V>
    promises: Map<K, Promise<V>>
    constructor() {
        this.map = new Map();
        this.promises = new Map();
    }

    async getOrSetAsync(key: K, setValue: () => Promise<V>): Promise<V> {
        if (this.map.has(key)) {
            return this.map.get(key);
        } else if (this.promises.has(key)) {
            return await this.promises.get(key);
        } else {
            const value = setValue();
            this.promises.set(key, value);
            const result = await value;
            this.map.set(key, result);
            return result;
        }
    }

}