class MemoizeCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || Infinity;
    this.strategy = options.strategy || 'lru';
    this.ttl = options.ttl || null; 
    this.customEvict = options.customEvict || null;
    
    this.cache = new Map(); 
    this.frequencyMap = new Map(); 
    this.timers = new Map(); 
  }

  _generateKey(args) {

    return JSON.stringify(args, (key, value) => {
      if (typeof value === 'function') {
        return value.toString();
      }
      return value;
    });
  }
_getMetadata() {
    return {
      timestamp: Date.now(),
      accessCount: 0
    };
  }

  _updateMetadata(key, metadata) {
    metadata.lastAccessed = Date.now();
    metadata.accessCount = (metadata.accessCount || 0) + 1;
    
    if (this.strategy === 'lfu') {
      this.frequencyMap.set(key, metadata.accessCount);
    }
  }

  _evict() {
    if (this.cache.size <= this.maxSize) return;
    
    switch(this.strategy) {
      case 'lru':
        this._evictLRU();
        break;
      case 'lfu':
        this._evictLFU();
        break;
      case 'ttl':
        this._evictTTL();
        break;
      default:
        if (this.customEvict) {
          this.customEvict(this.cache);
        } else {
          this._evictLRU(); 
        }
    }
  }
  _evictLRU() {
  
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (let [key, {metadata}] of this.cache.entries()) {
      if (metadata.lastAccessed < oldestTime) {
        oldestTime = metadata.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this._deleteEntry(oldestKey);
    }
  }

  _evictLFU() {

    let leastUsedKey = null;
    let minAccessCount = Infinity;
    
    for (let [key, {metadata}] of this.cache.entries()) {
      if (metadata.accessCount < minAccessCount) {
        minAccessCount = metadata.accessCount;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this._deleteEntry(leastUsedKey);
    }
  }

  _evictTTL() {

    const now = Date.now();
    const toDelete = [];
    
    for (let [key, {metadata}] of this.cache.entries()) {
      if (now - metadata.timestamp > this.ttl) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this._deleteEntry(key));
    
  
    if (this.cache.size > this.maxSize) {
      this._evictLRU();
    }
  }

  _deleteEntry(key) {
    this.cache.delete(key);
    this.frequencyMap.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }
 get(keyArgs) {
    const key = this._generateKey(keyArgs);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    

    if (this.ttl && (Date.now() - entry.metadata.timestamp > this.ttl)) {
      this._deleteEntry(key);
      return null;
    }
    
    this._updateMetadata(key, entry.metadata);
    return entry.value;
  }

  set(keyArgs, value) {
    const key = this._generateKey(keyArgs);
    const metadata = this._getMetadata();
    

    if (this.cache.has(key)) {
      this._deleteEntry(key);
    }
    
    this.cache.set(key, { value, metadata });
    this._updateMetadata(key, metadata);
    

    if (this.ttl) {
      const timer = setTimeout(() => {
        if (this.cache.has(key)) {
          this._deleteEntry(key);
        }
      }, this.ttl);
      this.timers.set(key, timer);
    }
    
    this._evict();
    
    return value;
  }

  clear() {
    this.cache.clear();
    this.frequencyMap.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }
}
function memoize(fn, options = {}) {
  const cache = new MemoizeCache(options);
  
  const memoizedFn = function(...args) {
    const cachedValue = cache.get(args);
    
    const cachedValue = cache.get(args);
    if (cachedValue !== undefined) return cachedValue;
    
    const result = fn.apply(this, args);
    cache.set(args, result);
    
    return result;
  };
  

  memoizedFn.clearCache = () => cache.clear();
  memoizedFn.getCacheSize = () => cache.size();
  memoizedFn.getCache = () => cache.cache;
  
  return memoizedFn;
}
class EnhancedMemoizeCache extends MemoizeCache {
  constructor(options = {}) {
    super(options);
    this.accessHistory = new Map(); 
    this.lastEvictCheck = Date.now();
    this.evictInterval = options.evictInterval || 60000; 
  }
  _defaultHash(args) {
    if (args.length === 0) return 'undefined';
    if (args.length === 1) {
      const arg = args[0];
      if (typeof arg === 'string' || typeof arg === 'number') {
        return String(arg);
      }
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
    }
    return JSON.stringify(args, this._jsonReplacer);
  }

  _jsonReplacer(key, value) {
    if (typeof value === 'function') {
      return `__func__${value.toString()}`;
    }
    if (value instanceof Date) {
      return `__date__${value.toISOString()}`;
    }
    if (value instanceof RegExp) {
      return `__regexp__${value.toString()}`;
    }
    return value;
  }

  _generateKey(args) {
    return this.hashFunction(args);
  }
  _evictAdaptive() {
   
    const hitRate = this._calculateHitRate();
    
    if (hitRate > 0.8) {
     
      this._evictLFUWithAging();
    } else {
      
      this._evictLRU();
    }
  }

  _calculateHitRate() {
   
    const totalAccesses = Array.from(this.cache.values())
      .reduce((sum, {metadata}) => sum + metadata.accessCount, 0);
    
    const cacheSize = this.cache.size;
    return cacheSize === 0 ? 0 : Math.min(1, totalAccesses / (cacheSize * 10));
  }

  
  _evict() {
  
    const now = Date.now();
    if (now - this.lastEvictCheck >= this.evictInterval) {
      this.lastEvictCheck = now;
      
      switch(this.strategy) {
        case 'lru':
          while (this.cache.size > this.maxSize) this._evictLRU();
          break;
        case 'lfu':
          while (this.cache.size > this.maxSize) this._evictLFUWithAging();
          break;
        case 'ttl':
          this._evictTTL();
          while (this.cache.size > this.maxSize) this._evictLRU();
          break;
        case 'adaptive':
          while (this.cache.size > this.maxSize) this._evictAdaptive();
          break;
        default:
          if (this.customEvict) {
            this.customEvict(this.cache);
          }
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      strategy: this.strategy,
      hitRate: this._calculateHitRate(),
      strategies: {
        lru: this.strategy === 'lru',
        lfu: this.strategy === 'lfu',
        ttl: !!this.ttl,
        adaptive: this.strategy === 'adaptive'
      }
    };
  }
}
function enhancedMemoize(fn, options = {}) {
  const cache = new EnhancedMemoizeCache(options);
  
  const memoizedFn = function(...args) {
    const cachedValue = cache.get(args);
    if (cachedValue !== undefined) return cachedValue;
    
    const result = fn.apply(this, args);
    cache.set(args, result);
    
    return result;
  };
  
  memoizedFn.clearCache = () => cache.clear();
  memoizedFn.getCacheSize = () => cache.size();
  memoizedFn.getStats = () => cache.getStats();
  memoizedFn.inspect = () => ({
    size: cache.size(),
    maxSize: cache.maxSize,
    strategy: cache.strategy,
    hasTTL: !!cache.ttl
  });
  
  return memoizedFn;
}
class OptimizedMemoizeCache extends EnhancedMemoizeCache {
  constructor(options = {}) {
    super(options);
    this.hashFunction = options.hashFunction || this._defaultHash;
    this.onEvict = options.onEvict || null; 
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccesses: 0
    };
  }

  _defaultHash(args) {
    
    if (args.length === 0) return 'undefined';
    if (args.length === 1) {
      const arg = args[0];
      if (typeof arg === 'string' || typeof arg === 'number') {
        return String(arg);
      }
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
    }
    return JSON.stringify(args, this._jsonReplacer);
  }

  _jsonReplacer(key, value) {
    if (typeof value === 'function') {
      return `__func__${value.toString()}`;
    }
    if (value instanceof Date) {
      return `__date__${value.toISOString()}`;
    }
    if (value instanceof RegExp) {
      return `__regexp__${value.toString()}`;
    }
    return value;
  }

  _generateKey(args) {
    return this.hashFunction(args);
  }

  _deleteEntry(key) {
    const entry = this.cache.get(key);
    if (entry && this.onEvict) {
      this.onEvict(key, entry.value, entry.metadata);
    }
    super._deleteEntry(key);
    this.stats.evictions++;
  }
    set(keyArgs, value) {
    const key = this._generateKey(keyArgs);
    const metadata = this._getMetadata();
    
    if (this.cache.has(key)) {
      this._deleteEntry(key);
    }
    
    this.cache.set(key, { value, metadata });
    this._updateMetadata(key, metadata);
    
   
    if (this.ttl && !this.timers.has(key)) {
      const timer = setTimeout(() => {
        if (this.cache.has(key)) {
          this._deleteEntry(key);
        }
      }, this.ttl);
      this.timers.set(key, timer);
    }
    
    this._evict();
    
    return value;
  }

  getStats() {
    return {
      ...super.getStats(),
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      totalAccesses: this.stats.totalAccesses,
      hitRate: this.stats.totalAccesses === 0 ? 0 : 
        this.stats.hits / this.stats.totalAccesses
    };
  }

 
  static createCustomPolicy(policyFn) {
    return (cache) => {
      const items = Array.from(cache.cache.entries());
      const toEvict = policyFn(items);
      toEvict.forEach(key => cache._deleteEntry(key));
    };
  }
}

}

 
 
