import LRU from "lru-cache"

export default class AsyncLRU<K, V> {
    map: LRU<K, V>
    promises: Map<K, Promise<V>>
    constructor(options: LRU.Options<K, V>) {
        this.map = new LRU(options);
        this.promises = new Map();
    }

    async getOrSetAsync(key: K, setValue: () => Promise<V>): Promise<V> {
        if (this.map.has(key)) {
            return this.map.get(key);
        } else if (this.promises.has(key)) {
            const v = await this.promises.get(key);
            return v;
        } else {
            const value = setValue();
            this.promises.set(key, value);
            const result = await value;
            this.map.set(key, result);
            this.promises.delete(key);
            return result;
        }
    }

}