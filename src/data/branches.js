/**
 * Static branch directory used while STATIC_MODE is on.
 * Mirrors the shape of GET /api/branches so the UI code stays compatible.
 * TODO: fill in real address/phone per branch from the client.
 */
export const BRANCHES = [
  { id: 1,  name: 'Life Saver Medical Services - Zabarte',             target_client: 'Yakap only',               area: 'NCR and Rizal',  province: 'NCR',      city: 'Quezon City',      address: '', phone: '' },
  { id: 2,  name: 'Life Saver Medical Services - Dona Imelda',         target_client: 'Yakap and Gamot - Owned',  area: 'NCR and Rizal',  province: 'NCR',      city: 'Quezon City',      address: '', phone: '' },
  { id: 3,  name: 'Life Saver Medical Services - Project 8 Bahay Toro', target_client: 'Yakap only',              area: 'NCR and Rizal',  province: 'NCR',      city: 'Quezon City',      address: '', phone: '' },
  { id: 4,  name: 'Life Saver Medical Services - San Juan',            target_client: 'Yakap only',               area: 'NCR and Rizal',  province: 'NCR',      city: 'San Juan',         address: '', phone: '' },
  { id: 5,  name: 'Life Saver Medical Services - Congressional Ave.',  target_client: 'Yakap only',               area: 'NCR and Rizal',  province: 'NCR',      city: 'Quezon City',      address: '', phone: '' },
  { id: 6,  name: 'Life Saver Medical Services - Novaliches',          target_client: 'Yakap and Gamot - Owned',  area: 'NCR and Rizal',  province: 'NCR',      city: 'Quezon City',      address: '', phone: '' },
  { id: 7,  name: 'Life Saver Pharmacy - Taguig',                      target_client: 'Drug Store - Stand Alone', area: 'NCR and Rizal',  province: 'NCR',      city: 'Taguig',           address: '', phone: '' },
  { id: 8,  name: 'Life Saver Medical Services - Taytay',              target_client: 'Yakap only',               area: 'NCR and Rizal',  province: 'Rizal',    city: 'Taytay',           address: '', phone: '' },
  { id: 9,  name: 'Life Saver Medical Services - Tanza',               target_client: 'Yakap only',               area: 'Southern Luzon', province: 'Cavite',   city: 'Tanza',            address: '', phone: '' },
  { id: 10, name: 'Life Saver Medical Services - Gen. Trias',          target_client: 'Yakap only',               area: 'Southern Luzon', province: 'Cavite',   city: 'Gen. Trias',       address: '', phone: '' },
  { id: 11, name: 'Life Saver Medical Services - Dasma',               target_client: 'Yakap only',               area: 'Southern Luzon', province: 'Cavite',   city: 'Dasmarinas',       address: '', phone: '' },
  { id: 12, name: 'Life Saver Medical Services - San Jose Batangas',   target_client: 'Yakap only',               area: 'Southern Luzon', province: 'Batangas', city: 'San Jose/Tanauan', address: '', phone: '' },
  { id: 13, name: 'Life Saver Medical Services - New Lucena',          target_client: 'Yakap only',               area: 'Visayas Area',   province: 'Iloilo',   city: 'New Lucena',       address: '', phone: '' },
]

export const PHARMACY_BRANCHES = BRANCHES.filter(
  (b) => b.target_client.includes('Gamot') || b.target_client.includes('Drug Store')
)
