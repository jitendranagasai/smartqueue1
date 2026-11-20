import mongoose, { Schema, Document, Types } from 'mongoose';
import { OrgType } from '../types/index.js';

export interface IOrganization extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  type: OrgType;
  address: string;
  city: string;
  state: string;
  pin: string;
  lat: number;
  lng: number;
  open: boolean;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: {
      type: String,
      enum: ['HOSPITAL', 'BANK', 'OFFICE', 'GOVERNMENT', 'INSTITUTE', 'SERVICE'],
      required: true,
      index: true
    },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, default: '', trim: true },
    pin: { type: String, default: '', trim: true, index: true },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    open: { type: Boolean, default: true },
    email: { type: String, required: true, trim: true, lowercase: true }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
