``` hs
class (Functor t, Foldable t) => Traversable t where
  traverse :: Applicative f => (a -> f b) -> t a -> f (t b)
```

Requires #[[Functor]] & #[[Foldable]]
