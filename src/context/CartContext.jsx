import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

const HARD_CAP = 99

/* Never let the cart hold more of a medicine than the branch actually has.
   product.stock is null before a branch is chosen, which means "no limit known". */
const capFor = (item) => (Number.isFinite(item.maxQty) ? Math.min(HARD_CAP, item.maxQty) : HARD_CAP)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const add = (product) =>
    setItems((prev) => {
      const maxQty = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null
      const found = prev.find((i) => i.product_id === product.id)
      if (found) {
        const cap = capFor({ maxQty: maxQty ?? found.maxQty })
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, maxQty: maxQty ?? i.maxQty, qty: Math.min(cap, i.qty + 1) } : i
        )
      }
      if (maxQty !== null && maxQty < 1) return prev
      return [
        ...prev,
        { product_id: product.id, name: product.name, price: Number(product.price), qty: 1, maxQty },
      ]
    })

  const setQty = (productId, qty) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, qty: Math.min(capFor(i), qty) } : i))
    )

  const clear = () => setItems([])

  const value = useMemo(() => {
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)
    const count = items.reduce((sum, i) => sum + i.qty, 0)
    return { items, add, setQty, clear, total, count }
  }, [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
