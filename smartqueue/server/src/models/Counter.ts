import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICounter extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  serviceId?: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const counterSchema = new Schema<ICounter>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        ret.orgId = ret.organizationId?.toString();
        ret.serviceId = ret.serviceId ? ret.serviceId.toString() : '';
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);
