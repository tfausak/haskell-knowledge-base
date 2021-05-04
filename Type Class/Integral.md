``` hs
class (Real a, Num a) => Integral a where
  quotRem :: a -> a -> (a, a)
  divMod :: a -> a -> (a, a)
  toInteger :: a -> Integer
```

[[Num]]