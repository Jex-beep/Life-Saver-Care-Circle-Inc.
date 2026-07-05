import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const add = (product) =>
    setItems((prev) => {
      const found = prev.find((i) => i.product_id === product.id)
      if (found) {
        return prev.map((i) => (i.product_id === product.id ? { ...i, qty: Math.min(99, i.qty + 1) } : i))
      }
      return [...prev, { product_id: product.id, name: product.name, price: Number(product.price), qty: 1 }]
    })

  const setQty = (productId, qty) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, qty: Math.min(99, qty) } : i))
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
