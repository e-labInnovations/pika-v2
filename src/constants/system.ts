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
        icon: 'Utensils',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Food and dining expenses',
        children: [
            {
                name: 'Dining Out',
                icon: 'Utensils',
                color: '#FFFFFF',
                bgColor: '#DD6B20',
                type: 'expense',
                description: 'Restaurant and dining out expenses',
            },
            {
                name: 'Groceries',
                icon: 'ShoppingBasket',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Grocery shopping expenses',
            },
            {
                name: 'Coffee & Snacks',
                icon: 'Coffee',
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
        icon: 'ShoppingCart',
        color: '#FFFFFF',
        bgColor: '#D53F8C',
        type: 'expense',
        description: 'Shopping expenses',
        children: [
            {
                name: 'Clothing',
                icon: 'Shirt',
                color: '#FFFFFF',
                bgColor: '#805AD5',
                type: 'expense',
                description: 'Clothing and apparel expenses',
            },
            {
                name: 'Electronics',
                icon: 'Monitor',
                color: '#FFFFFF',
                bgColor: '#2B6CB0',
                type: 'expense',
                description: 'Electronics and gadgets',
            },
            {
                name: 'Home Goods',
                icon: 'Sofa',
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
        icon: 'Car',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        type: 'expense',
        description: 'Transportation expenses',
        children: [
            {
                name: 'Fuel',
                icon: 'Fuel',
                color: '#FFFFFF',
                bgColor: '#C53030',
                type: 'expense',
                description: 'Fuel and gas expenses',
            },
            {
                name: 'Public Transit',
                icon: 'Bus',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'expense',
                description: 'Public transportation expenses',
            },
            {
                name: 'Maintenance',
                icon: 'Wrench',
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
        icon: 'Home',
        color: '#FFFFFF',
        bgColor: '#319795',
        type: 'expense',
        description: 'Housing expenses',
        children: [
            {
                name: 'Rent',
                icon: 'Key',
                color: '#FFFFFF',
                bgColor: '#2D3748',
                type: 'expense',
                description: 'Rent payments',
            },
            {
                name: 'Mortgage',
                icon: 'Building2',
                color: '#FFFFFF',
                bgColor: '#2A4365',
                type: 'expense',
                description: 'Mortgage payments',
            },
            {
                name: 'Maintenance',
                icon: 'Hammer',
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
        icon: 'Zap',
        color: '#000000',
        bgColor: '#F6E05E',
        type: 'expense',
        description: 'Utility bills',
        children: [
            {
                name: 'Electricity',
                icon: 'Zap',
                color: '#000000',
                bgColor: '#ECC94B',
                type: 'expense',
                description: 'Electricity bills',
            },
            {
                name: 'Water',
                icon: 'Droplet',
                color: '#FFFFFF',
                bgColor: '#0987A0',
                type: 'expense',
                description: 'Water bills',
            },
            {
                name: 'Internet',
                icon: 'Wifi',
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
        icon: 'Film',
        color: '#FFFFFF',
        bgColor: '#ED64A6',
        type: 'expense',
        description: 'Entertainment expenses',
        children: [
            {
                name: 'Movies',
                icon: 'Clapperboard',
                color: '#FFFFFF',
                bgColor: '#702459',
                type: 'expense',
                description: 'Movie and theater expenses',
            },
            {
                name: 'Games',
                icon: 'Gamepad2',
                color: '#FFFFFF',
                bgColor: '#4C51BF',
                type: 'expense',
                description: 'Gaming expenses',
            },
            {
                name: 'Music',
                icon: 'Music',
                color: '#FFFFFF',
                bgColor: '#9F7AEA',
                type: 'expense',
                description: 'Music and concerts',
            },
            {
                name: 'Sports',
                icon: 'Trophy',
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
        icon: 'Heart',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Healthcare expenses',
        children: [
            {
                name: 'Medical',
                icon: 'Stethoscope',
                color: '#FFFFFF',
                bgColor: '#C53030',
                type: 'expense',
                description: 'Medical expenses',
            },
            {
                name: 'Pharmacy',
                icon: 'Pill',
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
        icon: 'GraduationCap',
        color: '#FFFFFF',
        bgColor: '#4299E1',
        type: 'expense',
        description: 'Education expenses',
        children: [
            {
                name: 'Tuition',
                icon: 'School',
                color: '#FFFFFF',
                bgColor: '#3182CE',
                type: 'expense',
                description: 'Tuition fees',
            },
            {
                name: 'Books',
                icon: 'Book',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'expense',
                description: 'Books and supplies',
            },
            {
                name: 'Courses',
                icon: 'NotebookPen',
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
        icon: 'Smile',
        color: '#FFFFFF',
        bgColor: '#48BB78',
        type: 'expense',
        description: 'Personal care expenses',
        children: [
            {
                name: 'Hair Care',
                icon: 'Scissors',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Hair care and styling',
            },
            {
                name: 'Skincare',
                icon: 'Sparkles',
                color: '#FFFFFF',
                bgColor: '#68D391',
                type: 'expense',
                description: 'Skincare and beauty',
            },
            {
                name: 'Fitness',
                icon: 'Dumbbell',
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
        icon: 'Gift',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        type: 'expense',
        description: 'Gift expenses',
        children: [
            {
                name: 'Birthday',
                icon: 'Cake',
                color: '#FFFFFF',
                bgColor: '#ED8936',
                type: 'expense',
                description: 'Birthday gifts',
            },
            {
                name: 'Holiday',
                icon: 'Trees',
                color: '#FFFFFF',
                bgColor: '#38A169',
                type: 'expense',
                description: 'Holiday gifts',
            },
            {
                name: 'Special Occasion',
                icon: 'PartyPopper',
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
        icon: 'Plane',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        type: 'expense',
        description: 'Travel expenses',
        children: [
            {
                name: 'Flights',
                icon: 'PlaneTakeoff',
                color: '#FFFFFF',
                bgColor: '#2B6CB0',
                type: 'expense',
                description: 'Flight expenses',
            },
            {
                name: 'Hotels',
                icon: 'Hotel',
                color: '#FFFFFF',
                bgColor: '#B7791F',
                type: 'expense',
                description: 'Hotel and accommodation',
            },
            {
                name: 'Activities',
                icon: 'Umbrella',
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
        icon: 'Receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'expense',
        description: 'Uncategorized expenses',
        children: [
            {
                name: 'Other',
                icon: 'Receipt',
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
        icon: 'Briefcase',
        color: '#FFFFFF',
        bgColor: '#38A169',
        type: 'income',
        description: 'Work-related income',
        children: [
            {
                name: 'Salary',
                icon: 'DollarSign',
                color: '#FFFFFF',
                bgColor: '#48BB78',
                type: 'income',
                description: 'Regular salary income',
            },
            {
                name: 'Bonus',
                icon: 'Gem',
                color: '#FFFFFF',
                bgColor: '#ECC94B',
                type: 'income',
                description: 'Bonus and incentives',
            },
            {
                name: 'Freelance',
                icon: 'Laptop',
                color: '#FFFFFF',
                bgColor: '#4299E1',
                type: 'income',
                description: 'Freelance income',
            },
            {
                name: 'Investment',
                icon: 'TrendingUp',
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
        icon: 'Receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'income',
        description: 'Uncategorized income',
        children: [
            {
                name: 'Other',
                icon: 'Receipt',
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
        icon: 'PiggyBank',
        color: '#FFFFFF',
        bgColor: '#319795',
        type: 'transfer',
        description: 'Transfer expenses',
        children: [
            {
                name: 'Bank Transfer',
                icon: 'Landmark',
                color: '#FFFFFF',
                bgColor: '#2C5282',
                type: 'transfer',
                description: 'Bank transfers',
            },
            {
                name: 'ATM',
                icon: 'HandCoins',
                color: '#FFFFFF',
                bgColor: '#B7791F',
                type: 'transfer',
                description: 'ATM withdrawals',
            },
            {
                name: 'CDM',
                icon: 'BadgeDollarSign',
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
        icon: 'Receipt',
        color: '#FFFFFF',
        bgColor: '#718096',
        type: 'transfer',
        description: 'Uncategorized transfer',
        children: [
            {
                name: 'Other',
                icon: 'Receipt',
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
        icon: 'PlusCircle',
        color: '#FFFFFF',
        bgColor: '#38A169',
        description: 'Initial account balance transaction',
    },
    {
        name: 'Recurring',
        icon: 'Repeat',
        color: '#FFFFFF',
        bgColor: '#3182CE',
        description: 'Recurring transactions',
    },
    {
        name: 'Urgent',
        icon: 'AlertCircle',
        color: '#FFFFFF',
        bgColor: '#E53E3E',
        description: 'Urgent transactions',
    },
    {
        name: 'Shared',
        icon: 'Users',
        color: '#FFFFFF',
        bgColor: '#805AD5',
        description: 'Shared expenses',
    },
    {
        name: 'Personal',
        icon: 'User',
        color: '#FFFFFF',
        bgColor: '#DD6B20',
        description: 'Personal transactions',
    },
    {
        name: 'Business',
        icon: 'Briefcase',
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