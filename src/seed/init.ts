import { systemUser, categories, defaultTags, CategoryData } from '../constants/system';
import { Payload } from "payload";

export const onInit = async (payload: Payload) => {
    let systemUserId: number

    const existingUser = await payload.find({
        collection: 'users',
        where: {
            email: {
                equals: systemUser.email
            }
        }
    })

    // Create system user if it doesn't exist
    if (existingUser.docs.length === 0) {
        const createdUser = await payload.create({
            collection: 'users',
            data: {
                email: systemUser.email,
                name: systemUser.name,
                password: systemUser.password
            }
        })
        systemUserId = createdUser.id as number
        console.log(`✅ Created system user: ${systemUser.email}`)

        // Seed default categories
        await seedCategories(payload, systemUserId)
        
        // Seed default tags
        await seedTags(payload, systemUserId)
    } else {
        systemUserId = existingUser.docs[0].id as number
        console.log(`✅ System user already exists: ${systemUser.email}`)
    }
}

const seedCategories = async (payload: Payload, userId: number) => {
    for (const category of categories) {
        await createCategoryWithChildren(payload, userId, category, null)
    }
}

const createCategoryWithChildren = async (
    payload: Payload, 
    userId: number, 
    category: CategoryData, 
    parentId: number | null
) => {
    // Create the category
    const created = await payload.create({
        collection: 'categories',
        data: {
            name: category.name,
            icon: category.icon,
            color: category.color,
            bgColor: category.bgColor,
            type: category.type,
            description: category.description,
            parent: parentId,
            user: userId,
            isActive: true
        }
    })
    const categoryId = created.id as number
    console.log(`✅ Created category: ${category.name} (${category.type})`)

    // Create children if they exist
    if (category.children && category.children.length > 0) {
        for (const child of category.children) {
            await createCategoryWithChildren(payload, userId, child, categoryId)
        }
    }
}

const seedTags = async (payload: Payload, userId: number) => {
    for (const tag of defaultTags) {
        await payload.create({
            collection: 'tags',
            data: {
                name: tag.name,
                icon: tag.icon,
                color: tag.color,
                bgColor: tag.bgColor,
                description: tag.description,
                user: userId,
                isActive: true
            }
        })
        console.log(`✅ Created tag: ${tag.name}`)
    }
}