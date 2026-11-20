import mongoose, { Schema, Document, Types } from 'mongoose';
import { TicketStatus } from '../types/index.js';

export interface ITicket extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  customerId: Types.ObjectId;
  token: string;
  sequenceNumber: number;
  dateKey: string;
  status: TicketStatus;
  counterId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  calledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true },
    sequenceNumber: { type: Number, required: true },
    dateKey: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED'],
      default: 'WAITING',
      required: true,
      index: true
    },
    counterId: { type: Schema.Types.ObjectId, ref: 'Counter' },
    staffId: { type: Schema.Types.ObjectId, ref: 'User' },
    calledAt: { type: Date },
    completedAt: { type: Date }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        ret.orgId = ret.organizationId?.toString();
        ret.serviceId = ret.serviceId?.toString();
        ret.customerId = ret.customerId?.toString();
        ret.counterId = ret.counterId ? ret.counterId.toString() : undefined;
        ret.staffId = ret.staffId ? ret.staffId.toString() : undefined;
        ret.seq = ret.sequenceNumber;
        ret.createdAt = ret.createdAt ? new Date(ret.createdAt).getTime() : Date.now();
        ret.calledAt = ret.calledAt ? new Date(ret.calledAt).getTime() : undefined;
        ret.completedAt = ret.completedAt ? new Date(ret.completedAt).getTime() : undefined;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Prevent duplicate ticket numbers for the same service on the same day
ticketSchema.index({ serviceId: 1, dateKey: 1, sequenceNumber: 1 }, { unique: true });

// Optimize query for active customer ticket check
ticketSchema.index({ customerId: 1, serviceId: 1, dateKey: 1, status: 1 });

// Optimize query for waiting tickets sorted by sequence
ticketSchema.index({ serviceId: 1, dateKey: 1, status: 1, sequenceNumber: 1 });

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
