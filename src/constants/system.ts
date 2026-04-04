export const SYSTEM_USER_ID = 'cafecafe-cafe-4afe-8afe-cafecafecafe'

export const systemUser = {
    email: 'system@elabins.com',
    name: 'System User',
    password: 'System@123'
}

export interface CategoryData {
    name: string
    icon: string
    color: string
    bgColor: string
    type: 'expense' | 'income' | 'transfer'
    description: string
    children?: CategoryData[]
}

export interface TagData {
    name: string
    icon: string
    color: string
    bgColor: string
    description: string
}

export const defaultExpenseCategories: CategoryData[] = [
    // Food & Dining
    {
        name: 'Food & Dining',
        icon: 'utensils',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Food and dining expenses',
        children: [
            {
                name: 'Dining Out',
                icon: 'utensils',
                color: '#FFFFFF',
                bgColor: '#DD6B20',
                type: 'expense',
                description: 'Restaurant and dining out expenses',
            },
            {
                name: 'Groceries',
                icon: 'shopping-basket',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Grocery shopping expenses',
            },
            {
                name: 'Coffee & Snacks',
                icon: 'coffee',
                color: '#FFFFFF',
                bgColor: '#975A16',
                type: 'expense',
                description: 'Coffee and snack expenses',
            }
        ]
    },
    // Shopping
    {
        name: 'Shopping',
        icon: 'shopping-cart',
        color: '#FFFFFF',
        bgColor: '#D53F8C',
        type: 'expense',
        description: 'Shopping expenses',
        children: [
            {
                name: 'Clothing',
                icon: 'shirt',
                color: '#FFFFFF',
                bgColor: '#805AD5',
                type: 'expense',
                description: 'Clothing and apparel expenses',
            },
            {
                name: 'Electronics',
                icon: 'monitor',
                color: '#FFFFFF',
                bgColor: '#2B6CB0',
                type: 'expense',
                description: 'Electronics and gadgets',
            },
            {
                name: 'Home Goods',
                icon: 'sofa',
                color: '#FFFFFF',
                bgColor: '#B83280',
                type: 'expense',
                description: 'Home and furniture expenses',
            }
        ]
    },
    // Transportation
    {
        name: 'Transportation',
        icon: 'car',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        type: 'expense',
        description: 'Transportation expenses',
        children: [
            {
                name: 'Fuel',
                icon: 'fuel',
                color: '#FFFFFF',
                bgColor: '#C53030',
                type: 'expense',
                description: 'Fuel and gas expenses',
            },
            {
                name: 'Public Transit',
                icon: 'bus',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'expense',
                description: 'Public transportation expenses',
            },
            {
                name: 'Maintenance',
                icon: 'wrench',
                color: '#FFFFFF',
                bgColor: '#744210',
                type: 'expense',
                description: 'Vehicle maintenance expenses',
            }
        ]
    },
    // Housing
    {
        name: 'Housing',
        icon: 'house',
        color: '#FFFFFF',
        bgColor: '#319795',
        type: 'expense',
        description: 'Housing expenses',
        children: [
            {
                name: 'Rent',
                icon: 'key',
                color: '#FFFFFF',
                bgColor: '#2D3748',
                type: 'expense',
                description: 'Rent payments',
            },
            {
                name: 'Mortgage',
                icon: 'building-2',
                color: '#FFFFFF',
                bgColor: '#2A4365',
                type: 'expense',
                description: 'Mortgage payments',
            },
            {
                name: 'Maintenance',
                icon: 'hammer',
                color: '#FFFFFF',
                bgColor: '#B7791F',
                type: 'expense',
                description: 'Home maintenance expenses',
            }
        ]
    },
    // Utilities
    {
        name: 'Utilities',
        icon: 'zap',
        color: '#000000',
        bgColor: '#F6E05E',
        type: 'expense',
        description: 'Utility bills',
        children: [
            {
                name: 'Electricity',
                icon: 'zap',
                color: '#000000',
                bgColor: '#ECC94B',
                type: 'expense',
                description: 'Electricity bills',
            },
            {
                name: 'Water',
                icon: 'droplet',
                color: '#FFFFFF',
                bgColor: '#0987A0',
                type: 'expense',
                description: 'Water bills',
            },
            {
                name: 'Internet',
                icon: 'wifi',
                color: '#FFFFFF',
                bgColor: '#553C9A',
                type: 'expense',
                description: 'Internet and phone bills',
            }
        ]
    },
    // Entertainment
    {
        name: 'Entertainment',
        icon: 'film',
        color: '#FFFFFF',
        bgColor: '#ED64A6',
        type: 'expense',
        description: 'Entertainment expenses',
        children: [
            {
                name: 'Movies',
                icon: 'clapperboard',
                color: '#FFFFFF',
                bgColor: '#702459',
                type: 'expense',
                description: 'Movie and theater expenses',
            },
            {
                name: 'Games',
                icon: 'gamepad-2',
                color: '#FFFFFF',
                bgColor: '#4C51BF',
                type: 'expense',
                description: 'Gaming expenses',
            },
            {
                name: 'Music',
                icon: 'music',
                color: '#FFFFFF',
                bgColor: '#9F7AEA',
                type: 'expense',
                description: 'Music and concerts',
            },
            {
                name: 'Sports',
                icon: 'trophy',
                color: '#FFFFFF',
                bgColor: '#F56500',
                type: 'expense',
                description: 'Sports and fitness expenses',
            }
        ]
    },
    // Healthcare
    {
        name: 'Healthcare',
        icon: 'heart',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Healthcare expenses',
        children: [
            {
                name: 'Medical',
                icon: 'stethoscope',
                color: '#FFFFFF',
                bgColor: '#C53030',
                type: 'expense',
                description: 'Medical expenses',
            },
            {
                name: 'Pharmacy',
                icon: 'pill',
                color: '#FFFFFF',
                bgColor: '#2B6CB0',
                type: 'expense',
                description: 'Pharmacy expenses',
            }
        ]
    },
    // Education
    {
        name: 'Education',
        icon: 'graduation-cap',
        color: '#FFFFFF',
        bgColor: '#4299E1',
        type: 'expense',
        description: 'Education expenses',
        children: [
            {
                name: 'Tuition',
                icon: 'school',
                color: '#FFFFFF',
                bgColor: '#3182CE',
                type: 'expense',
                description: 'Tuition fees',
            },
            {
                name: 'Books',
                icon: 'book',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'expense',
                description: 'Books and supplies',
            },
            {
                name: 'Courses',
                icon: 'notebook-pen',
                color: '#FFFFFF',
                bgColor: '#2A4365',
                type: 'expense',
                description: 'Online courses and training',
            }
        ]
    },
    // Personal Care
    {
        name: 'Personal Care',
        icon: 'smile',
        color: '#FFFFFF',
        bgColor: '#48BB78',
        type: 'expense',
        description: 'Personal care expenses',
        children: [
            {
                name: 'Hair Care',
                icon: 'scissors',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Hair care and styling',
            },
            {
                name: 'Skincare',
                icon: 'sparkles',
                color: '#FFFFFF',
                bgColor: '#68D391',
                type: 'expense',
                description: 'Skincare and beauty',
            },
            {
                name: 'Fitness',
                icon: 'dumbbell',
                color: '#FFFFFF',
                bgColor: '#2F855A',
                type: 'expense',
                description: 'Fitness and gym expenses',
            }
        ]
    },
    // Gifts
    {
        name: 'Gifts',
        icon: 'gift',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Gift expenses',
        children: [
            {
                name: 'Birthday',
                icon: 'cake',
                color: '#FFFFFF',
                bgColor: '#ED8936',
                type: 'expense',
                description: 'Birthday gifts',
            },
            {
                name: 'Holiday',
                icon: 'trees',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Holiday gifts',
            },
            {
                name: 'Special Occasion',
                icon: 'party-popper',
                color: '#FFFFFF',
                bgColor: '#D69E2E',
                type: 'expense',
                description: 'Special occasion gifts',
            }
        ]
    },
    // Travel
    {
        name: 'Travel',
        icon: 'plane',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        type: 'expense',
        description: 'Travel expenses',
        children: [
            {
                name: 'Flights',
                icon: 'plane-takeoff',
                color: '#FFFFFF',
                bgColor: '#2B6CB0',
                type: 'expense',
                description: 'Flight expenses',
            },
            {
                name: 'Hotels',
                icon: 'hotel',
                color: '#FFFFFF',
                bgColor: '#B7791F',
                type: 'expense',
                description: 'Hotel and accommodation',
            },
            {
                name: 'Activities',
                icon: 'umbrella',
                color: '#FFFFFF',
                bgColor: '#319795',
                type: 'expense',
                description: 'Travel activities and tours',
            }
        ]
    },
    // Uncategorized
    {
        name: 'Uncategorized',
        icon: 'receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'expense',
        description: 'Uncategorized expenses',
        children: [
            {
                name: 'Other',
                icon: 'receipt',
                color: '#FFFFFF',
                bgColor: '#4A5568',
                type: 'expense',
                description: 'Other expenses',
            }
        ]
    }
]

export const defaultIncomeCategories: CategoryData[] = [
    {
        name: 'Work',
        icon: 'briefcase',
        color: '#FFFFFF',
        bgColor: '#38A169',
        type: 'income',
        description: 'Work-related income',
        children: [
            {
                name: 'Salary',
                icon: 'dollar-sign',
                color: '#FFFFFF',
                bgColor: '#48BB78',
                type: 'income',
                description: 'Regular salary income',
            },
            {
                name: 'Bonus',
                icon: 'gem',
                color: '#FFFFFF',
                bgColor: '#ECC94B',
                type: 'income',
                description: 'Bonus and incentives',
            },
            {
                name: 'Freelance',
                icon: 'laptop',
                color: '#FFFFFF',
                bgColor: '#4299E1',
                type: 'income',
                description: 'Freelance income',
            },
            {
                name: 'Investment',
                icon: 'trending-up',
                color: '#FFFFFF',
                bgColor: '#2F855A',
                type: 'income',
                description: 'Investment returns',
            }
        ]
    },
    // Uncategorized
    {
        name: 'Uncategorized',
        icon: 'receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'income',
        description: 'Uncategorized income',
        children: [
            {
                name: 'Other',
                icon: 'receipt',
                color: '#FFFFFF',
                bgColor: '#4A5568',
                type: 'income',
                description: 'Other income sources',
            }
        ]
    }
]

export const defaultTransferCategories: CategoryData[] = [
    {
        name: 'Transfer',
        icon: 'piggy-bank',
        color: '#FFFFFF',
        bgColor: '#319795',
        type: 'transfer',
        description: 'Transfer expenses',
        children: [
            {
                name: 'Bank Transfer',
                icon: 'landmark',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'transfer',
                description: 'Bank transfers',
            },
            {
                name: 'ATM',
                icon: 'hand-coins',
                color: '#FFFFFF',
                bgColor: '#B7791F',
                type: 'transfer',
                description: 'ATM withdrawals',
            },
            {
                name: 'CDM',
                icon: 'badge-dollar-sign',
                color: '#FFFFFF',
                bgColor: '#D69E2E',
                type: 'transfer',
                description: 'Cash deposit machine',
            }
        ]
    },
    // Uncategorized
    {
        name: 'Uncategorized',
        icon: 'receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'transfer',
        description: 'Uncategorized transfer',
        children: [
            {
                name: 'Other',
                icon: 'receipt',
                color: '#FFFFFF',
                bgColor: '#4A5568',
                type: 'transfer',
                description: 'Other transfers',
            }
        ]
    }
]

export const defaultTags: TagData[] = [
    {
        name: 'Initial Balance',
        icon: 'circle-plus',
        color: '#FFFFFF',
        bgColor: '#38A169',
        description: 'Initial account balance transaction',
    },
    {
        name: 'Recurring',
        icon: 'repeat',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        description: 'Recurring transactions',
    },
    {
        name: 'Urgent',
        icon: 'circle-alert',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        description: 'Urgent transactions',
    },
    {
        name: 'Shared',
        icon: 'users',
        color: '#FFFFFF',
        bgColor: '#805AD5',
        description: 'Shared expenses',
    },
    {
        name: 'Personal',
        icon: 'user',
        color: '#FFFFFF',
        bgColor: '#DD6B20',
        description: 'Personal transactions',
    },
    {
        name: 'Business',
        icon: 'briefcase',
        color: '#FFFFFF',
        bgColor: '#2D3748',
        description: 'Business transactions',
    }
]

export const categories = [
    ...defaultExpenseCategories,
    ...defaultIncomeCategories,
    ...defaultTransferCategories
]