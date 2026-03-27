Task 3: Implementing a Memoization Function

Implement a memoization function that wraps any pure function, caching results to avoid redundant calculations. Additionally, supports a configurable eviction strategy to determine which cached elements should be removed when the cache reaches a limit.

Requirements:
1.	Core Memoization Functionality
	•	Accept a pure function and return a memoized version of it.
	•	Store previously computed results to avoid recomputation.
2.	Cache Storage and Lookup
	•	Cache function calls based on input arguments as keys.
	•	Support configurable cache size (default: unlimited).
3.	Cache Eviction Policies (Configurable)
	•	Least Recently Used (LRU): Remove the oldest unused entries when the cache reaches its maximum size.
	•	Least Frequently Used (LFU): Remove entries that are least accessed.
	•	Time-Based Expiry: Expire cache entries after a configurable time limit.
	•	Custom Policy: Allow users to pass a custom eviction function.
4.	Performance Considerations
	•	Avoid excessive memory consumption by automatically pruning the cache based on the selected strategy.
