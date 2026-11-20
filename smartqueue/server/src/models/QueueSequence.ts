import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IQueueSequence extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  serviceId: Types.ObjectId;
  dateKey: string;
  lastSequenceNumber: number;
}

const queueSequenceSchema = new Schema<IQueueSequence>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    dateKey: { type: String, required: true },
    lastSequenceNumber: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

queueSequenceSchema.index({ serviceId: 1, dateKey: 1 }, { unique: true });

export const QueueSequence = mongoose.model<IQueueSequence>('QueueSequence', queueSequenceSchema);
