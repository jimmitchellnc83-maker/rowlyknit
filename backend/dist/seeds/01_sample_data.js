"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = seed;
const password_1 = require("../src/utils/password");
async function seed(knex) {
    // Delete existing data
    await knex('gifts').del();
    await knex('recipients').del();
    await knex('project_tools').del();
    await knex('tools').del();
    await knex('project_yarn').del();
    await knex('yarn').del();
    await knex('project_patterns').del();
    await knex('patterns').del();
    await knex('counter_history').del();
    await knex('counters').del();
    await knex('project_photos').del();
    await knex('projects').del();
    await knex('sessions').del();
    await knex('tokens').del();
    await knex('audit_logs').del();
    await knex('users').del();
    // Create demo user
    const passwordHash = await (0, password_1.hashPassword)('Demo123!@#');
    const [demoUser] = await knex('users')
        .insert({
        email: 'demo@rowlyknit.com',
        password_hash: passwordHash,
        first_name: 'Demo',
        last_name: 'User',
        username: 'demouser',
        email_verified: true,
        is_active: true,
        preferences: JSON.stringify({
            theme: 'light',
            notifications: true,
            units: 'imperial',
        }),
    })
        .returning('*');
    console.log('✓ Created demo user');
    // Create sample projects
    const [project1] = await knex('projects').insert([
        {
            user_id: demoUser.id,
            name: 'Cozy Winter Scarf',
            description: 'A beautiful ribbed scarf in soft merino wool',
            status: 'active',
            project_type: 'scarf',
            start_date: new Date('2024-01-15'),
            target_completion_date: new Date('2024-02-15'),
            notes: 'Using a simple 2x2 rib pattern. Started with 40 stitches.',
            metadata: JSON.stringify({
                gauge: '20 sts x 28 rows = 4 inches',
                needles: 'US 7 (4.5mm)',
                dimensions: '8" x 60"',
            }),
            tags: JSON.stringify(['winter', 'gift', 'beginner-friendly']),
            progress_percentage: 45,
        },
    ]).returning('*');
    const [project2] = await knex('projects').insert([
        {
            user_id: demoUser.id,
            name: 'Baby Blanket for Emma',
            description: 'Soft cotton baby blanket with cable pattern',
            status: 'active',
            project_type: 'blanket',
            start_date: new Date('2024-02-01'),
            target_completion_date: new Date('2024-04-01'),
            notes: 'Gift for my niece. Using machine washable cotton.',
            metadata: JSON.stringify({
                gauge: '18 sts x 24 rows = 4 inches',
                needles: 'US 8 (5mm) circular',
                dimensions: '30" x 36"',
            }),
            tags: JSON.stringify(['baby', 'gift', 'cotton']),
            progress_percentage: 20,
        },
    ]).returning('*');
    const [project3] = await knex('projects').insert([
        {
            user_id: demoUser.id,
            name: 'Classic Wool Socks',
            description: 'Warm wool socks with afterthought heel',
            status: 'completed',
            project_type: 'socks',
            start_date: new Date('2023-11-01'),
            actual_completion_date: new Date('2023-12-15'),
            notes: 'These turned out great! Making another pair.',
            metadata: JSON.stringify({
                gauge: '28 sts x 36 rows = 4 inches',
                needles: 'US 2 (2.75mm) DPNs',
                size: 'Adult medium',
            }),
            tags: JSON.stringify(['socks', 'wool', 'winter']),
            progress_percentage: 100,
        },
    ]).returning('*');
    console.log('✓ Created sample projects');
    // Create counters for active projects
    await knex('counters').insert([
        {
            project_id: project1.id,
            name: 'Row Counter',
            type: 'row',
            current_value: 135,
            target_value: 300,
            increment_by: 1,
            is_active: true,
            sort_order: 0,
        },
        {
            project_id: project2.id,
            name: 'Row Counter',
            type: 'row',
            current_value: 48,
            target_value: 240,
            increment_by: 1,
            is_active: true,
            sort_order: 0,
        },
        {
            project_id: project2.id,
            name: 'Cable Repeat',
            type: 'repeat',
            current_value: 6,
            target_value: 30,
            increment_by: 1,
            is_active: true,
            sort_order: 1,
        },
    ]);
    console.log('✓ Created counters');
    // Create sample patterns
    const [pattern1, pattern2] = await knex('patterns').insert([
        {
            user_id: demoUser.id,
            name: 'Simple Ribbed Scarf',
            description: 'Classic 2x2 ribbed scarf pattern, perfect for beginners',
            designer: 'Jane Knitter',
            source: 'website',
            source_url: 'https://example.com/ribbed-scarf',
            difficulty: 'beginner',
            category: 'scarf',
            yarn_requirements: JSON.stringify([
                { weight: 'worsted', yardage: 400, fiber: 'wool' },
            ]),
            needle_sizes: JSON.stringify(['US 7 (4.5mm)']),
            gauge: JSON.stringify({ stitches: 20, rows: 28, unit: '4 inches' }),
            estimated_yardage: 400,
            tags: JSON.stringify(['beginner', 'quick', 'classic']),
            is_favorite: true,
            times_used: 3,
        },
        {
            user_id: demoUser.id,
            name: 'Cabled Baby Blanket',
            description: 'Beautiful cable pattern blanket suitable for babies',
            designer: 'Sarah Designer',
            source: 'book',
            difficulty: 'intermediate',
            category: 'blanket',
            yarn_requirements: JSON.stringify([
                { weight: 'worsted', yardage: 1200, fiber: 'cotton' },
            ]),
            needle_sizes: JSON.stringify(['US 8 (5mm)']),
            gauge: JSON.stringify({ stitches: 18, rows: 24, unit: '4 inches' }),
            sizes_available: JSON.stringify(['30x36', '36x42']),
            estimated_yardage: 1200,
            tags: JSON.stringify(['baby', 'cables', 'cotton']),
            is_favorite: true,
            times_used: 1,
        },
    ]).returning('*');
    // Link patterns to projects
    await knex('project_patterns').insert([
        {
            project_id: project1.id,
            pattern_id: pattern1.id,
            modifications: 'Made it 8 inches wider',
        },
        {
            project_id: project2.id,
            pattern_id: pattern2.id,
            modifications: 'Using different cable pattern',
        },
    ]);
    console.log('✓ Created patterns');
    // Create yarn stash
    const [yarn1, yarn2, yarn3] = await knex('yarn').insert([
        {
            user_id: demoUser.id,
            brand: 'Cascade Yarns',
            line: '220 Superwash',
            name: 'Cascade 220',
            color: 'Navy Blue',
            color_code: '1234',
            weight: 'worsted',
            fiber_content: '100% Superwash Merino Wool',
            yards_total: 220,
            yards_remaining: 80,
            grams_total: 100,
            grams_remaining: 36,
            skeins_total: 3,
            skeins_remaining: 1,
            price_per_skein: 11.50,
            purchase_date: new Date('2023-12-01'),
            purchase_location: 'Local Yarn Shop',
            dye_lot: 'A1234',
            tags: JSON.stringify(['wool', 'washable', 'navy']),
            is_favorite: true,
            is_stash: true,
        },
        {
            user_id: demoUser.id,
            brand: 'Berroco',
            line: 'Comfort',
            name: 'Berroco Comfort',
            color: 'Cream',
            weight: 'worsted',
            fiber_content: '50% Acrylic, 50% Nylon',
            yards_total: 210,
            yards_remaining: 210,
            grams_total: 100,
            grams_remaining: 100,
            skeins_total: 6,
            skeins_remaining: 6,
            price_per_skein: 7.50,
            purchase_date: new Date('2024-01-15'),
            purchase_location: 'Online - Webs',
            tags: JSON.stringify(['baby-friendly', 'machine-wash', 'cream']),
            is_stash: true,
        },
        {
            user_id: demoUser.id,
            brand: 'Malabrigo',
            line: 'Rios',
            name: 'Malabrigo Rios',
            color: 'Archangel',
            weight: 'worsted',
            fiber_content: '100% Superwash Merino',
            yards_total: 210,
            yards_remaining: 0,
            grams_total: 100,
            grams_remaining: 0,
            skeins_total: 2,
            skeins_remaining: 0,
            price_per_skein: 16.00,
            purchase_date: new Date('2023-10-01'),
            tags: JSON.stringify(['used', 'luxury', 'blue']),
            is_stash: false,
        },
    ]).returning('*');
    // Link yarn to projects
    await knex('project_yarn').insert([
        {
            project_id: project1.id,
            yarn_id: yarn1.id,
            yards_used: 320,
            skeins_used: 2,
        },
        {
            project_id: project2.id,
            yarn_id: yarn2.id,
            yards_used: 0,
            skeins_used: 0,
        },
        {
            project_id: project3.id,
            yarn_id: yarn3.id,
            yards_used: 420,
            skeins_used: 2,
        },
    ]);
    console.log('✓ Created yarn stash');
    // Create tools
    const [tool1, tool2] = await knex('tools').insert([
        {
            user_id: demoUser.id,
            type: 'circular',
            name: 'Circular Needle',
            size: 'US 7',
            size_mm: 4.5,
            material: 'bamboo',
            length: 32,
            brand: 'ChiaoGoo',
            quantity: 1,
            is_available: false,
            notes: 'Currently using for scarf project',
            purchase_date: new Date('2023-06-01'),
            purchase_price: 15.00,
        },
        {
            user_id: demoUser.id,
            type: 'circular',
            name: 'Circular Needle',
            size: 'US 8',
            size_mm: 5.0,
            material: 'metal',
            length: 40,
            brand: 'Addi',
            quantity: 1,
            is_available: false,
            notes: 'Currently using for baby blanket',
            purchase_date: new Date('2023-08-15'),
            purchase_price: 18.00,
        },
    ]).returning('*');
    // Link tools to projects
    await knex('project_tools').insert([
        {
            project_id: project1.id,
            tool_id: tool1.id,
        },
        {
            project_id: project2.id,
            tool_id: tool2.id,
        },
    ]);
    console.log('✓ Created tools');
    // Create recipients
    const [recipient1] = await knex('recipients').insert([
        {
            user_id: demoUser.id,
            first_name: 'Emma',
            last_name: 'Johnson',
            relationship: 'niece',
            birthday: new Date('2023-06-15'),
            measurements: JSON.stringify({
                chest: '18 inches',
                length: '12 inches',
            }),
            preferences: JSON.stringify({
                colors: ['pink', 'purple', 'yellow'],
                fiber_allergies: ['wool'],
            }),
            notes: 'Loves soft, cuddly items. No wool due to sensitivity.',
        },
    ]).returning('*');
    // Create gift
    await knex('gifts').insert([
        {
            recipient_id: recipient1.id,
            project_id: project2.id,
            occasion: 'birthday',
            date_given: null,
            notes: 'Planning to give this for first birthday',
            was_liked: true,
        },
    ]);
    console.log('✓ Created recipients and gifts');
    console.log('\n✅ Sample data seeded successfully!');
    console.log('\nDemo account credentials:');
    console.log('Email: demo@rowlyknit.com');
    console.log('Password: Demo123!@#');
}
