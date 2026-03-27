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

}
