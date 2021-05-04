``` hs
class Foldable t where
  foldMap :: Monoid m => (a -> m) -> t a -> m
```

[[Traversable]]
[[Monoid]]
