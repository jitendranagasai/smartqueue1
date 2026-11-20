import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { config } from '../config/environment.js';
import {
  User,
  Organization,
  Service,
  Counter,
  Ticket,
  QueueSequence,
  Notification
} from '../models/index.js';
import { ORGANIZATION_TYPES, getOperatingDateKey, getTodayMidnight } from './constants.js';

export async function seedDatabase(force = false) {
  if (config.nodeEnv === 'production' && !force) {
    throw new Error('Database seeding is strictly disabled in production!');
  }

  console.log('[Seed] Clearing existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Service.deleteMany({}),
    Counter.deleteMany({}),
    Ticket.deleteMany({}),
    QueueSequence.deleteMany({}),
    Notification.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Demo@1234', 10);
  const now = Date.now();
  const dayMs = 864e5;
  const todayKey = getOperatingDateKey();

  console.log('[Seed] Creating demo customer accounts...');
  const customerNames = [
    'Ravi Kumar',
    'Sneha Reddy',
    'Arjun Rao',
    'Lakshmi Devi',
    'Imran Shaik',
    'Divya Prasad',
    'Kiran Babu',
    'Meena Sree'
  ];

  const createdCustomers = [];
  for (let i = 0; i < customerNames.length; i++) {
    const name = customerNames[i];
    const email = `${name.split(' ')[0].toLowerCase()}@mail.com`;
    const cust = await User.create({
      name,
      email,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date(now - 30 * dayMs)
    });
    createdCustomers.push(cust);
  }

  const demoCustomer = await User.create({
    name: 'Demo Customer',
    email: 'customer@smartqueue.com',
    passwordHash,
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdAt: new Date(now - dayMs)
  });
  createdCustomers.push(demoCustomer);

  const orgDefinitions = [
    { key: 'apollo', name: 'Apollo Hospital', type: 'HOSPITAL' as const, code: 'SQ-HOSP-1024', city: 'Vijayawada', state: 'Andhra Pradesh', pin: '520010', address: 'Benz Circle, MG Road', lat: 16.5062, lng: 80.648, email: 'apollo@smartqueue.com' },
    { key: 'citycare', name: 'City Care Hospital', type: 'HOSPITAL' as const, code: 'SQ-HOSP-1031', city: 'Vijayawada', state: 'Andhra Pradesh', pin: '520002', address: 'Governorpet', lat: 16.5193, lng: 80.6305, email: 'citycare@example.com' },
    { key: 'hdfc', name: 'HDFC Bank', type: 'BANK' as const, code: 'SQ-BANK-2056', city: 'Vijayawada', state: 'Andhra Pradesh', pin: '520010', address: 'Labbipet Main Branch', lat: 16.515, lng: 80.64, email: 'hdfc@example.com' },
    { key: 'abc', name: 'ABC Private Office', type: 'OFFICE' as const, code: 'SQ-OFFICE-3098', city: 'Guntur', state: 'Andhra Pradesh', pin: '522001', address: 'Brodipet 4th Line', lat: 16.3067, lng: 80.4365, email: 'abc@example.com' },
    { key: 'vidya', name: 'Sri Vidya Institute', type: 'INSTITUTE' as const, code: 'SQ-INST-4012', city: 'Tadepalligudem', state: 'Andhra Pradesh', pin: '534101', address: 'College Road', lat: 16.812, lng: 81.527, email: 'vidya@example.com' },
    { key: 'xyz', name: 'XYZ Service Center', type: 'SERVICE' as const, code: 'SQ-SERV-5011', city: 'Visakhapatnam', state: 'Andhra Pradesh', pin: '530003', address: 'Dwaraka Nagar', lat: 17.6868, lng: 83.2185, email: 'xyz@example.com' },
    { key: 'mro', name: 'Mandal Revenue Office', type: 'GOVERNMENT' as const, code: 'SQ-GOV-6001', city: 'Eluru', state: 'Andhra Pradesh', pin: '534001', address: 'Collectorate Road', lat: 16.7107, lng: 81.0952, email: 'mro@example.com' }
  ];

  console.log('[Seed] Creating organizations, services, counters, staff, and tickets...');
  for (const def of orgDefinitions) {
    const org = await Organization.create({
      name: def.name,
      code: def.code,
      type: def.type,
      address: def.address,
      city: def.city,
      state: def.state,
      pin: def.pin,
      lat: def.lat,
      lng: def.lng,
      open: true,
      email: def.email
    });

    // Create Admin
    const adminEmail = def.key === 'apollo' ? 'admin@smartqueue.com' : `admin-${def.key}@smartqueue.com`;
    await User.create({
      name: `${def.name} Admin`,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      organizationId: org._id,
      status: 'ACTIVE',
      createdAt: new Date(now - 60 * dayMs)
    });

    const template = ORGANIZATION_TYPES[def.type];
    const servicesList = template.services;

    for (let i = 0; i < servicesList.length; i++) {
      const sName = servicesList[i];
      const prefix = String.fromCharCode(65 + i);
      const avg = 5 + ((i * 3) % 9);

      const service = await Service.create({
        organizationId: org._id,
        name: sName,
        prefix,
        averageServiceTime: avg,
        enabled: true,
        open: true,
        capacity: 50
      });

      // Create Counter for first 3 services
      let counter: any = null;
      if (i < 3) {
        counter = await Counter.create({
          organizationId: org._id,
          name: `Counter ${i + 1}`,
          serviceId: service._id,
          active: true
        });
      }

      // Create Staff for first 2 services
      let staff: any = null;
      if (i < 2) {
        const staffEmail = def.key === 'apollo' && i === 0 ? 'staff@smartqueue.com' : `staff${i + 1}-${def.key}@smartqueue.com`;
        const staffName = i === 0 ? 'Anita Sharma' : 'Rahul Verma';
        staff = await User.create({
          name: staffName,
          email: staffEmail,
          passwordHash,
          role: 'STAFF',
          organizationId: org._id,
          serviceId: service._id,
          counterId: counter ? counter._id : undefined,
          status: 'ACTIVE',
          createdAt: new Date(now - 40 * dayMs)
        });
      }

      // Populate sample historical tickets (past 7 days)
      for (let k = 1; k <= 7; k++) {
        const pastDate = new Date(now - k * dayMs);
        const pastDateKey = getOperatingDateKey(pastDate);
        const count = 3 + (i % 3);

        for (let j = 1; j <= count; j++) {
          const createdAt = new Date(pastDate.getTime() + (8 + j) * 36e5);
          const calledAt = new Date(createdAt.getTime() + (3 + j * 2) * 6e4);
          const completedAt = new Date(calledAt.getTime() + avg * 6e4);
          const randCust = createdCustomers[j % createdCustomers.length];

          await Ticket.create({
            organizationId: org._id,
            serviceId: service._id,
            customerId: randCust._id,
            token: `${prefix}-${String(j).padStart(3, '0')}`,
            sequenceNumber: j,
            dateKey: pastDateKey,
            status: j === count ? 'CANCELLED' : 'COMPLETED',
            counterId: counter?._id,
            staffId: staff?._id,
            calledAt: j === count ? undefined : calledAt,
            completedAt: j === count ? undefined : completedAt,
            createdAt
          });
        }
      }

      // Today's tickets
      let currentSeq = 0;
      // 3 Completed tickets earlier today
      for (let j = 1; j <= 3; j++) {
        currentSeq++;
        const createdAt = new Date(now - (180 - j * 30) * 6e4);
        const calledAt = new Date(createdAt.getTime() + 6e4 * 5);
        const completedAt = new Date(calledAt.getTime() + 6e4 * avg);
        const cust = createdCustomers[(j + 2) % createdCustomers.length];

        await Ticket.create({
          organizationId: org._id,
          serviceId: service._id,
          customerId: cust._id,
          token: `${prefix}-${String(currentSeq).padStart(3, '0')}`,
          sequenceNumber: currentSeq,
          dateKey: todayKey,
          status: 'COMPLETED',
          counterId: counter?._id,
          staffId: staff?._id,
          calledAt,
          completedAt,
          createdAt
        });
      }

      // For Apollo's first service, create 1 SERVING ticket (assigned to Anita Sharma) and a few WAITING tickets
      if (def.key === 'apollo' && i === 0 && staff && counter) {
        currentSeq++;
        const servingTicket = await Ticket.create({
          organizationId: org._id,
          serviceId: service._id,
          customerId: createdCustomers[0]._id,
          token: `${prefix}-${String(currentSeq).padStart(3, '0')}`,
          sequenceNumber: currentSeq,
          dateKey: todayKey,
          status: 'SERVING',
          counterId: counter._id,
          staffId: staff._id,
          calledAt: new Date(now - 5 * 6e4),
          createdAt: new Date(now - 25 * 6e4)
        });

        // Add a notification for this customer
        await Notification.create({
          userId: createdCustomers[0]._id,
          organizationId: org._id,
          message: `Please proceed to ${counter.name}. Token ${servingTicket.token} is now being served.`,
          type: 'info',
          read: false,
          createdAt: new Date(now - 5 * 6e4)
        });
      }

      // Waiting tickets for today
      const waitingCount = def.key === 'apollo' && i < 2 ? 4 : (i < 2 ? 2 : 0);
      for (let w = 0; w < waitingCount; w++) {
        currentSeq++;
        const cust = createdCustomers[(w + 1) % createdCustomers.length];
        await Ticket.create({
          organizationId: org._id,
          serviceId: service._id,
          customerId: cust._id,
          token: `${prefix}-${String(currentSeq).padStart(3, '0')}`,
          sequenceNumber: currentSeq,
          dateKey: todayKey,
          status: 'WAITING',
          createdAt: new Date(now - (20 - w * 3) * 6e4)
        });
      }

      // Record last sequence number in QueueSequence
      await QueueSequence.create({
        organizationId: org._id,
        serviceId: service._id,
        dateKey: todayKey,
        lastSequenceNumber: currentSeq
      });
    }
  }

  console.log('[Seed] Seeding completed successfully!');
}

// Allow direct execution: npx tsx src/utils/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
  (async () => {
    try {
      await connectDatabase();
      await seedDatabase(true);
      await disconnectDatabase();
      process.exit(0);
    } catch (err: any) {
      console.error('[Seed] Fatal error:', err);
      process.exit(1);
    }
  })();
}
