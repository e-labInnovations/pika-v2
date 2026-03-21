import { systemUser, categories, defaultTags, CategoryData } from '../constants/system';
import { Payload } from "payload";

export const onInit = async (payload: Payload) => {
    // Wait for at least one real user to exist before seeding.
    // This preserves Payload's built-in "create first user" onboarding flow.
    const realUsers = await payload.find({
        collection: 'users',
        where: { role: { not_equals: 'system' } },
        limit: 1,
        depth: 0,
    })

    if (realUsers.totalDocs === 0) {
        console.log('⏳ No users found — skipping seed. Restart the server after creating your admin account.')
        return
    }

    const existingUser = await payload.find({
        collection: 'users',
        where: { email: { equals: systemUser.email } },
    })

    if (existingUser.docs.length === 0) {
        const createdUser = await payload.create({
            collection: 'users',
            data: {
                email: systemUser.email,
                name: systemUser.name,
                password: systemUser.password,
                role: 'system',
            },
        })
        const systemUserId = createdUser.id as string
        console.log(`✅ Created system user: ${systemUser.email} (id: ${systemUserId})`)

        await seedCategories(payload, systemUserId)
        await seedTags(payload, systemUserId)
    } else {
        console.log(`✅ System user already exists: ${systemUser.email}`)
    }
}

const seedCategories = async (payload: Payload, userId: string) => {
    for (const category of categories) {
        await createCategoryWithChildren(payload, userId, category, null)
    }
}

const createCategoryWithChildren = async (
    payload: Payload,
    userId: string,
    category: CategoryData,
    parentId: string | null
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
    const categoryId = created.id as string
    console.log(`✅ Created category: ${category.name} (${category.type})`)

    // Create children if they exist
    if (category.children && category.children.length > 0) {
        for (const child of category.children) {
            await createCategoryWithChildren(payload, userId, child, categoryId)
        }
    }
}

const seedTags = async (payload: Payload, userId: string) => {
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