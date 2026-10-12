import type { AuthSession, Cart, Product, User } from "@/lib/api/schemas";

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: "Essence Mascara Lash Princess",
    description: "A lengthening mascara for a dramatic look.",
    category: "beauty",
    price: 9.99,
    discountPercentage: 7.17,
    rating: 4.94,
    stock: 5,
    tags: ["beauty", "mascara"],
    brand: "Essence",
    sku: "BEA-ESS-ESS-001",
    weight: 4,
    dimensions: { width: 15.14, height: 13.08, depth: 22.99 },
    warrantyInformation: "1 week warranty",
    shippingInformation: "Ships in 3-5 business days",
    availabilityStatus: "In Stock",
    reviews: [
      {
        rating: 5,
        comment: "Great product!",
        date: "2024-05-23T08:56:21.618Z",
        reviewerName: "John Doe",
        reviewerEmail: "john.doe@x.dummyjson.com",
      },
    ],
    returnPolicy: "30 days return policy",
    minimumOrderQuantity: 1,
    images: ["https://cdn.dummyjson.com/products/images/beauty/1.png"],
    thumbnail: "https://cdn.dummyjson.com/products/images/beauty/1.png",
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    firstName: "Emily",
    lastName: "Johnson",
    maidenName: "Smith",
    age: 28,
    gender: "female",
    email: "emily.johnson@x.dummyjson.com",
    phone: "+81 965-431-3024",
    username: "emilys",
    password: "emilyspass",
    birthDate: "1996-5-30",
    image: "https://dummyjson.com/icon/emilys/128",
    bloodGroup: "O-",
    height: 193.24,
    weight: 63.16,
    eyeColor: "Green",
    hair: { color: "Brown", type: "Curly" },
    ip: "42.48.100.32",
    address: {
      address: "626 Main Street",
      city: "Phoenix",
      state: "Mississippi",
      stateCode: "MS",
      postalCode: "29112",
      coordinates: { lat: -77.16213, lng: -92.084824 },
      country: "United States",
    },
    macAddress: "47:fa:41:18:ec:eb",
    university: "University of Wisconsin--Madison",
    bank: {
      cardExpire: "03/26",
      cardNumber: "9289760655481815",
      cardType: "Elo",
      currency: "CNY",
      iban: "YPUXISOBI7TTHPK2BR3HAIXL",
    },
    company: {
      department: "Engineering",
      name: "Dooley, Kozey and Cronin",
      title: "Sales Manager",
      address: {
        address: "263 Tenth Street",
        city: "San Francisco",
        state: "Wisconsin",
        stateCode: "WI",
        postalCode: "37657",
        coordinates: { lat: 71.814525, lng: -161.150263 },
        country: "United States",
      },
    },
    ein: "977-175",
    ssn: "900-590-289",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/133.0",
    crypto: {
      coin: "Bitcoin",
      wallet: "0xb9fc2fe63b2a6c003f1c324c3bfa53259162181a",
      network: "Ethereum (ERC20)",
    },
    role: "admin",
    ...overrides,
  };
}

export function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: 1,
    products: [
      {
        id: 1,
        title: "Essence Mascara Lash Princess",
        price: 9.99,
        quantity: 2,
        total: 19.98,
        discountPercentage: 7.17,
        discountedTotal: 18.54,
        thumbnail: "https://cdn.dummyjson.com/products/images/beauty/1.png",
      },
    ],
    total: 19.98,
    discountedTotal: 18.54,
    userId: 1,
    totalProducts: 1,
    totalQuantity: 2,
    ...overrides,
  };
}

export function makeAuthSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: "header.access.payload",
    refreshToken: "header.refresh.payload",
    id: 1,
    username: "emilys",
    email: "emily.johnson@x.dummyjson.com",
    firstName: "Emily",
    lastName: "Johnson",
    gender: "female",
    image: "https://dummyjson.com/icon/emilys/128",
    ...overrides,
  };
}
